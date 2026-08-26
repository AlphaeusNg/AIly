param(
    [Parameter(Mandatory = $true)]
    [string]$InstallerPath,
    [Parameter(Mandatory = $true)]
    [string]$ExpectedVersion
)

$ErrorActionPreference = "Stop"
$uninstallRoot = "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall"

function Get-AIlyUninstallEntry {
    if (-not (Test-Path $uninstallRoot)) { return $null }
    return Get-ChildItem $uninstallRoot |
        ForEach-Object { Get-ItemProperty $_.PSPath } |
        Where-Object { $_.DisplayName -eq "AIly" } |
        Select-Object -First 1
}

function Split-UninstallCommand([string]$Command) {
    $expanded = [Environment]::ExpandEnvironmentVariables($Command).Trim()
    if ($expanded -match '^"([^"]+)"\s*(.*)$') {
        return @{ Path = $Matches[1]; Arguments = $Matches[2] }
    }
    if ($expanded -match '^(\S+)\s*(.*)$') {
        return @{ Path = $Matches[1]; Arguments = $Matches[2] }
    }
    throw "AIly uninstall command could not be parsed."
}

$installer = (Resolve-Path $InstallerPath).Path
if (Get-AIlyUninstallEntry) {
    throw "AIly was already installed on this runner; smoke test requires a clean baseline."
}

$appProcess = $null
$installLocation = $null
$smokeFailure = $null

try {
    $install = Start-Process -FilePath $installer -ArgumentList "/S" -Wait -PassThru
    if ($install.ExitCode -ne 0) {
        throw "AIly installer exited with code $($install.ExitCode)."
    }

    $deadline = (Get-Date).AddSeconds(15)
    do {
        $entry = Get-AIlyUninstallEntry
        if (-not $entry) { Start-Sleep -Milliseconds 500 }
    } while (-not $entry -and (Get-Date) -lt $deadline)
    if (-not $entry) { throw "AIly uninstall registry entry was not created." }
    if ([string]$entry.DisplayVersion -ne $ExpectedVersion) {
        throw "Installed AIly version '$($entry.DisplayVersion)' did not match '$ExpectedVersion'."
    }

    $installLocation = [Environment]::ExpandEnvironmentVariables(
        [string]$entry.InstallLocation
    ).Trim().Trim('"')
    if (-not $installLocation) {
        throw "AIly uninstall metadata did not include InstallLocation."
    }
    $executable = Join-Path $installLocation "aily-desktop.exe"
    if (-not (Test-Path $executable -PathType Leaf)) {
        throw "Installed AIly executable was not found at '$executable'."
    }

    $appProcess = Start-Process -FilePath $executable -PassThru
    $deadline = (Get-Date).AddSeconds(30)
    do {
        Start-Sleep -Milliseconds 500
        $appProcess.Refresh()
    } while (-not $appProcess.HasExited -and
        $appProcess.MainWindowTitle -ne "AIly — Ready" -and
        (Get-Date) -lt $deadline)
    if ($appProcess.HasExited) {
        throw "Installed AIly exited before opening its window."
    }
    if ($appProcess.MainWindowHandle -eq 0) {
        throw "Installed AIly did not open a window within 30 seconds."
    }
    if ($appProcess.MainWindowTitle -ne "AIly — Ready") {
        throw "Installed app window never reached the frontend-and-IPC ready state; title was '$($appProcess.MainWindowTitle)'."
    }
    Write-Host "Installed and launched AIly $ExpectedVersion from $installLocation"
} catch {
    $smokeFailure = $_
} finally {
    if ($appProcess -and -not $appProcess.HasExited) {
        Stop-Process -Id $appProcess.Id -Force
        $appProcess.WaitForExit()
    }
    $entry = Get-AIlyUninstallEntry
    if ($entry -and $entry.UninstallString) {
        $command = Split-UninstallCommand ([string]$entry.UninstallString)
        $arguments = ([string]$command.Arguments).Trim()
        if ($arguments) { $arguments = "$arguments /S" } else { $arguments = "/S" }
        $uninstall = Start-Process -FilePath $command.Path -ArgumentList $arguments -Wait -PassThru
        if ($uninstall.ExitCode -ne 0 -and -not $smokeFailure) {
            $smokeFailure = "AIly uninstaller exited with code $($uninstall.ExitCode)."
        }
    }
}

if ($smokeFailure) { throw $smokeFailure }
if (Get-AIlyUninstallEntry) { throw "AIly uninstall registry entry remains after uninstall." }
if ($installLocation -and (Test-Path $installLocation)) {
    throw "AIly install directory remains after uninstall: $installLocation"
}
Write-Host "AIly Windows install, launch, and uninstall smoke test passed."
