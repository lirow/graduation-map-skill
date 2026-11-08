---
type: 技能参考
scope: skills-on-demand / 生活 / graduation-map
updated: 2026-11-08
tags: [skill, graduation-map]
tldr: "graduation-map 的 verification 参考说明。"
---

# Focused verification

Run the Python validation and build first. Then open the output as a local `file://` page in a WebGL-capable browser; merely testing an HTTP development server does not establish double-click usability.

## Core checks

- Switch the browser offline, reload, and verify the embedded engine, outlines, names and source image (if attached) still load. Street detail attempts automatic loading only when reachable; it must not block the offline core.
- With controlled source responses, verify automatic street enabling, silent source/tile failure and timeout fallback, offline-to-online recovery, and persistence of a manual off choice. Do not replace source reachability checks with `navigator.onLine`, and do not add network prompts/toasts. Report mocked service checks separately from a live provider check.
- Compare total students, each region count, school/campus count and shared-school membership. Unknown points must not disappear from the roster or produce fake points.
- Search a name; select a province; open a school; clear the filter; show pending records; return to the class overview. Detail cards, breadcrumb, highlight, routes and list must agree.
- Mutate a test copy: remove a school's only student, add an overseas region, clear a coordinate, set the mother school to null, and use an empty roster. Statistics and about text must follow the data and no console errors should appear.
- Confirm the export matches the same data source used by the page.
- For source analysis, reconcile original detail rows, grouped names, duplicate evidence, aggregate-only rows, same-name people, corrections and completeness claims. Record which actual files/formats were read; a hypothetical spreadsheet scenario is not a real workbook parsing test.

## Map and mobile traps

MapLibre 5.6.2 retains camera padding from `easeTo`. Before computing a new `fitBounds`, clear old padding or otherwise account for it. Repeated school → province → class transitions should fit correctly, including short screens.

Test 320×568 and 390×844 portrait, plus 844×390 landscape. Check the center of each control with `elementFromPoint`; a visible button can still be blocked by the roster or detail panel. Open a crowded school's details, use the layer switches, scroll the roster, and rotate the viewport while a school is selected.

`touchZoomRotate.isEnabled()` only checks configuration. For a gesture claim, use real browser touch input (for example Playwright CDP `Input.dispatchTouchEvent`) and confirm zoom changes after spreading/pinching two contacts. Confirm rotation with a two-contact angular movement. A direct call to `map.zoomIn()` is not a touch test. Report browser emulation separately from physical-device testing.

Leader-line origins must remain anchored to projected school coordinates as the camera moves. Dense labels may collapse or hide to avoid collisions; the roster remains the accessible route to every record. Do not place labels on top of controls or the selected detail panel.

## Optional bundled QA

The skill's `tests/browser.cjs` verifies the generated fictional demo, including the mobile gestures. Set `DEMO_HTML` to the generated fictional HTML. It needs Node.js, Playwright and a Chromium browser; these are development dependencies, not requirements for generating or opening the HTML.

From the standalone skill directory, optional local assembly is:

```sh
python3 scripts/validate_data.py --data examples/demo-data.json
python3 scripts/build.py --data examples/demo-data.json --output /tmp/graduation-demo.html
```

In a full development checkout, run Python unit tests and `node tests/model.cjs`. For browser QA use Node.js 20+, `npm ci`, `npx playwright install chromium`, then `DEMO_HTML=/tmp/graduation-demo.html npm run test:browser`. In the public repository root, prefix builder paths with `skills/graduation-map/`; its tests and npm package are at the repository root. An installed skill need not include development tests.
