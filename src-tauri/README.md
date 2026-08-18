# AIly desktop shell (Tauri 2)

Wraps `apps/web` as a Windows app. **Not** a Cargo workspace member — Linux
`npm test` must stay WebKit-free.

## Build (Windows host)

```text
npx --yes @tauri-apps/cli@2 build --bundles nsis
```

Artifact: `target/release/bundle/nsis/*-setup.exe` — CI renames it `AIly-setup.exe`.

Unsigned on purpose. Auto-start is off. OS usage/blocks are **not** in this shell.
