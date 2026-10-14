# AIly UI sizing audit — 2026-10-14

Audited Chromium web layouts at 320×740, 375×812, 768×1024 and 1280×800.
Additional passes used 375px with the root font at 200%, 1280px with CSS `zoom: 2`,
and 375px compact density. CSS zoom is a controlled enlargement check, not a
claim of testing an operating system's native browser zoom UI.

## Coverage and evidence

A seeded target with a 48-character title and two commitments exercised real
Today controls, custom focus, commitment actions, Targets forms, Review, Usage,
Blocks, Setup/display preferences and Activity. App usage and block-admin
consent were off for the ordinary panel checks. Additional states covered the
opening tutorial, usage consent tutorial, admin consent tutorial, consented
break-glass, keyboard help, check-in and mobile More menu: 14 states across
seven viewport/settings combinations, 98 measured states and full-page captures.

Six repeatable browser regressions in `tools/browser/ui-sizing.spec.mjs` check
all seven tabs, custom focus and commitment disclosures, permission-off copy,
dialog bounds and scrolling to the final dialog action. They run in `npm test`;
run just this coverage with:

```sh
npx playwright test tools/browser/ui-sizing.spec.mjs
```

Session screenshots and JSON measurements are retained under
`/tmp/sizing-20261014-AIly-artifacts/`: `before/` contains 66 baseline states;
`after/` contains 98 corrected states. These are local audit artifacts, not
application assets. Visual review included phone Today and forms, enlarged Help
and permission tutorial, tablet Blocks and desktop Setup/check-in. Additional
viewport captures use the `viewport-` prefix.

## Findings and changes

| Observed defect | Before | Result |
|---|---|---|
| Long target choice widened Today | Document width 562px at both 320px and 375px | Controls shrink inside the available width; grid tracks can shrink. Today fits both widths. |
| Enlarged text widened forms/navigation and headings | Setup measured 446px at a 375px viewport; Today reached 1102px | Inputs/buttons have bounded width, mobile grid tracks shrink, long headings and button labels wrap. All 98 final states fit horizontally. |
| Tall dialogs extended above the screen | Help top −113.7px at 320px; −1114.4px with 200% text at 375px | Dialog height is bounded by the backdrop, with internal vertical scrolling. At 375px/200% text, tall dialogs fit from y=32 to y=780; final actions are reachable. Responsive side padding gives enlarged headings more room. |
| Hidden skip link stayed tiny even on keyboard focus | Focused box remained 1×1px | Focus reveals the link with readable padding and an outline; all six sizing regressions check its focused box. |
| Small disclosure and secondary targets | Custom/commitment summaries 19px high; version button 19.8px | Disclosures, checkbox labels and version-copy target have a 24px minimum height. Main buttons retain their existing compact padding. |
| Next-commitment card did not allow its action to wrap | Enlarged text competed with Done in one flex row | The card can wrap the action as needed. Normal desktop and phone layouts retain their existing structure. |

The fixes constrain intrinsic sizing and permit reflow; they do not hide page
overflow or remove content. Native selects may truncate a long selected label
inside their closed control; opening the browser's select still exposes its
options. Text fields keep normal horizontal editing behavior.

## Evaluation basis and limits

[W3C target-size guidance](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html)
uses a 24×24 CSS-pixel minimum with spacing, equivalent-control, inline,
user-agent and essential exceptions. The audit did not treat every small glyph
as a failing target: native checkbox glyphs retain their browser rendering and
associated clickable labels, the visually hidden skip link is checked through
its focus behavior rather than its hidden box, and the Windows download text is
an inline link. Increasing every control to 44px would conflict with this app's
compact phone layout; primary controls already exceed the minimum height.

[W3C reflow guidance](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html)
and [resize-text guidance](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html)
informed the narrow-width and enlarged-text checks. This is a focused sizing
review, not a formal WCAG conformance assessment or proof of optimality for every
possible saved string, language, browser or assistive technology.

Native Windows/Android OS dialogs, physical touch accuracy, virtual keyboards,
OS font scaling, safe-area cutouts and physical-device permission journeys were
not tested here. Consent and usage behavior were not changed. Existing modal
focus/keyboard tests remain in the full gate. Physical-device checks and the
native glib advisory remain open.

## Validation and publication

The complete Rust/format/Clippy/Node gate and 25 Chromium journeys passed;
affected sizing journeys were rerun after the final side-padding adjustment.
Android JVM tests and a real debug APK build passed, including package identity,
version and signature verification. Web/worker stamp: `2026.10.14.2`. Native
version: `0.1.12`, Android code 12. Hosted installed-Windows checks and verified
package release publication follow the main push.

## Packaging follow-up

The initial native 0.1.12 version edit changed two unrelated Cargo.lock package
versions; hosted Windows validation rejected them. Restored the original
find-msvc-tools and winapi-util 0.1.11 records with unchanged checksums. The failed tag
remains immutable; corrected installers are released as native 0.1.13 / code 13.
Web layout stamp stays 2026.10.14.2.
