# Focused verification

Run the Python validation and build first. Then open the output as a local `file://` page in a WebGL-capable browser; merely testing an HTTP development server does not establish double-click usability.

## Core checks

- Block HTTP requests or switch the browser offline, reload, and verify the embedded engine, outlines, names and source image (if attached) still load. Online street detail is deliberately optional.
- Compare total students, each region count, school/campus count and shared-school membership. Unknown points must not disappear from the roster or produce fake points.
- Search a name; select a province; open a school; clear the filter; show pending records; return to the class overview. Detail cards, breadcrumb, highlight, routes and list must agree.
- Mutate a test copy: remove a school's only student, add an overseas region, clear a coordinate, set the mother school to null, and use an empty roster. Statistics and about text must follow the data and no console errors should appear.
- Confirm the export matches the same data source used by the page.

## Map and mobile traps

MapLibre 5.6.2 retains camera padding from `easeTo`. Before computing a new `fitBounds`, clear old padding or otherwise account for it. Repeated school → province → class transitions should fit correctly, including short screens.

Test 320×568 and 390×844 portrait, plus 844×390 landscape. Check the center of each control with `elementFromPoint`; a visible button can still be blocked by the roster or detail panel. Open a crowded school's details, use the layer switches, scroll the roster, and rotate the viewport while a school is selected.

`touchZoomRotate.isEnabled()` only checks configuration. For a gesture claim, use real browser touch input (for example Playwright CDP `Input.dispatchTouchEvent`) and confirm zoom changes after spreading/pinching two contacts. Confirm rotation with a two-contact angular movement. A direct call to `map.zoomIn()` is not a touch test. Report browser emulation separately from physical-device testing.

Leader-line origins must remain anchored to projected school coordinates as the camera moves. Dense labels may collapse or hide to avoid collisions; the roster remains the accessible route to every record. Do not place labels on top of controls or the selected detail panel.

## Optional bundled QA

The repository's `tests/browser.cjs` verifies the generated fictional demo, including the mobile gestures. It needs Node.js, Playwright and a Chromium browser; these are development dependencies, not requirements for generating or opening the HTML.
