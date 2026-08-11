# Privacy

- Targets, plans, usage samples, block rules, and audit stay **on this device** by default.
- Usage monitoring requires an explicit grant in the tutorial.
- Web/PWA consent auto-logs **AIly in-app attention** (visible + focused time only); other apps remain manual samples there.
- The Capacitor Android APK also requires the system **Usage Access** grant. It requests up to 50 Android-reported foreground totals for the current local day on demand/resume, does not run a background collector, and does not copy those OS totals into exports or backups.
- Block admin is a separate grant; revocable in Setup.
- No cloud upload of app timelines or Android usage totals.
- Activity log is local and inspectable (plain-language labels in the UI).
- Export backup is a local JSON file you choose to save; import replaces local state only after confirmation.
- Browser Notification permission may be requested for “stay in touch”; denial does not break the app.
