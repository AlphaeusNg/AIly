# AIly 0.1.5 security update

The Android shell now uses Capacitor 7.6.9, which fixes [GHSA-rvm3-566m-v7fv](https://github.com/advisories/GHSA-rvm3-566m-v7fv). The advisory describes a crafted link that lets attacker-controlled content execute with the app’s origin and reach Capacitor plugins. Disabling CapacitorHttp alone does not fix the vulnerable internal proxy.

Installed copies must be rebuilt and updated to receive the native patch. A PWA refresh cannot patch an older APK. Version 0.1.5 increments Android’s version code and keeps the desktop/package version consistent. The release workflow builds and verifies both installers and publishes their checksums before attaching them to a tagged release.

The locked CLI dependency tree also includes the brace-expansion fix. `npm audit` reports zero vulnerabilities on this dependency tree as of 2026-10-07; this result does not cover Rust dependencies or guarantee every platform is vulnerability-free.

Local validation covers Rust and browser contracts, Android JVM tests, and a rebuilt APK. Windows native and installer checks run on the Windows release runner. Physical-device validation remains outstanding.
