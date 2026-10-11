# Dependabot #14 — glib `VariantStrIter` unsoundness

Triage for [Dependabot alert #14](https://github.com/AlphaeusNg/AIly/security/dependabot/14). Verified against AIly main tip `8112b22f2c6b2229308f6b766aaca5525506e872` (7 Oct 2026). This note does not close or dismiss the alert.

## 1. What the advisory is

[GHSA-wrw7-89jp-8q8g](https://github.com/advisories/GHSA-wrw7-89jp-8q8g) (also [RUSTSEC-2024-0429](https://rustsec.org/advisories/RUSTSEC-2024-0429.html)) is a **medium** unsoundness in the `Iterator` / `DoubleEndedIterator` impls for `glib::VariantStrIter`.

- Vulnerable range: `glib` >= 0.15.0, < 0.20.0
- First patched: 0.20.0
- Upstream fix: [gtk-rs/gtk-rs-core#1343](https://github.com/gtk-rs/gtk-rs-core/pull/1343) (pass the C out-argument as `&mut p` instead of `&p`)

Locked on that tip in `src-tauri/Cargo.lock`: **glib 0.18.5**, glib-sys 0.18.1, gtk 0.18.2, tauri 2.11.5, wry 0.55.1, tao 0.35.3. AIly’s `src-tauri/Cargo.toml` declares `tauri = "2"` with no direct glib/gtk dependency. glib enters only as a Linux host transitive of tauri/wry/tao → gtk.

## 2. Why there is no upgrade path yet

crates.io re-check (7 Oct 2026): latest stable **tauri 2.12.1**, **wry 0.57.0**, and **tao 0.37.1** all still declare `gtk ^0.18` under the Linux/BSD target cfg. gtk 0.18.2 depends on `glib ^0.18` (still < 0.20). A lockfile bump therefore cannot reach glib 0.20.0.

gtk 0.19.0 exists and depends on glib ^0.22, but Tauri/wry/tao do not accept gtk 0.19 yet (they pin `^0.18`), so that is not an available path for AIly.

## 3. Which AIly targets actually compile glib

glib/gtk compile only for **Linux/BSD host** targets via Tauri’s Linux WebView (webkit2gtk).

AIly currently ships **Windows** (Tauri/NSIS) and **Android** (APK). The browser PWA has no Rust/glib. AIly does not currently ship a Linux desktop package, so the vulnerable code is not in the artifacts users install today; it remains in the lockfile for anyone who builds the Tauri shell on Linux.

## 4. When to re-check

Re-check when Tauri and/or wry/tao move their Linux deps to gtk-rs 0.20+ (or otherwise allow glib >= 0.20). Then bump the lock, verify [Dependabot #14](https://github.com/AlphaeusNg/AIly/security/dependabot/14) closes, and close the alert.
