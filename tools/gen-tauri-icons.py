#!/usr/bin/env python3
"""Generate Tauri icons with its pinned CLI and keep only Windows inputs."""

from __future__ import annotations

import shutil
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "apps" / "web" / "icons" / "icon-512.png"
OUT = ROOT / "src-tauri" / "icons"
TAURI_CLI = "@tauri-apps/cli@2.11.4"
WINDOWS_ICONS = ("32x32.png", "128x128.png", "128x128@2x.png", "icon.ico")


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"missing {SOURCE}")

    OUT.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="aily-tauri-icons-") as temp_dir:
        subprocess.run(
            ["npx", "--yes", TAURI_CLI, "icon", str(SOURCE), "--output", temp_dir],
            check=True,
            cwd=ROOT,
        )
        for name in WINDOWS_ICONS:
            shutil.copyfile(Path(temp_dir) / name, OUT / name)

    print(f"wrote {len(WINDOWS_ICONS)} Windows icons in {OUT}")


if __name__ == "__main__":
    main()
