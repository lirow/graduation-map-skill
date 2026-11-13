---
type: 技能参考
scope: skills-on-demand / 生活 / graduation-map
updated: 2026-11-08
tags: [skill, graduation-map]
tldr: "graduation-map 的 verification 参考说明。"
---

# Focused verification

Run the Python validation and build first. Then open the output as a local `file://` page; merely testing an HTTP development server does not establish double-click usability. Test both the normal 3D path and the independent offline 2D renderer.

## Core checks

- Switch the browser offline, reload, and verify the embedded engine, outlines and names still load. Check that original-image controls, comparison dialogs and source evidence are absent from the HTML and JSON export. Street detail attempts automatic loading only when reachable; it must not block the offline core.
- With controlled source responses, verify automatic street enabling, silent source/tile failure and timeout fallback, offline-to-online recovery, and persistence of a manual off choice. Do not replace source reachability checks with `navigator.onLine`, and do not add network prompts/toasts. Report mocked service checks separately from a live provider check.
- Compare total students, each region count, school/campus count and shared-school membership. Unknown points must not disappear from the roster or produce fake points.
- Search a name; select a province; open a school; clear the filter; show pending records; return to the class overview. Detail cards, breadcrumb, highlight, routes and list must agree.
- Mutate a test copy: remove a school's only student, add an overseas region, clear a coordinate, set the mother school to null, and use an empty roster. Statistics and about text must follow the data and no console errors should appear.
- Confirm the export matches the same data source used by the page.
- Run `tests/compatibility.cjs` against the same demo. Disable WebGL, remove/block workers, stall worker messages and remove the 3D engine separately; verify the page still displays actual geography, selects schools, searches and exports. Trigger context loss with a school selected and routes off; verify the selection and toggle survive and no stale error layer blocks controls.
- Emulate DPR 3 on a phone; inspect backing-canvas size and antialias settings. Verify actual 2D pinch and pan input, not only calls to zoom APIs. Keep device simulation separate from physical Xiaomi testing; see [compatibility.md](compatibility.md).
- For source analysis, reconcile original detail rows, grouped names, duplicate evidence, aggregate-only rows, same-name people, corrections and completeness claims. Record which actual files/formats were read; a hypothetical spreadsheet scenario is not a real workbook parsing test.
- Exercise the agent workflow: a clear complete roster still requires full-data review; a correction requires a complete updated table and another confirmation; only explicit confirmation of the current version permits HTML generation. Check student, school/location, class, mother-school and setting data are all available to the user.

## Map and mobile traps

MapLibre 5.6.2 retains camera padding from `easeTo`. Before computing a new `fitBounds`, clear old padding or otherwise account for it. Repeated school → province → class transitions should fit correctly, including short screens.

Test 320×568 and 390×844 portrait, plus 844×390 landscape. Check the center of each control with `elementFromPoint`; a visible button can still be blocked by the roster or detail panel. Open a crowded school's details, use the layer switches, scroll the roster, and rotate the viewport while a school is selected.

`touchZoomRotate.isEnabled()` only checks configuration. For a gesture claim, use real browser touch input (for example Playwright CDP `Input.dispatchTouchEvent`) and confirm zoom changes after spreading/pinching two contacts. Confirm rotation with a two-contact angular movement. A direct call to `map.zoomIn()` is not a touch test. Report browser emulation separately from physical-device testing.

Leader-line origins must remain anchored to projected school coordinates as the camera moves. Dense labels may collapse or hide to avoid collisions; the roster remains the accessible route to every record. Do not place labels on top of controls or the selected detail panel.

## 没有 Playwright 时的轻量验证

`tests/browser.cjs` 需要 Node.js 20+、Playwright 和 Chromium。三者不具备时，仍可完成渲染层面的核对，不要因为装不上依赖就跳过验证或只做静态检查。

**截图 + 注入脚本取文本**，两步都只用系统自带的 Chrome：

```sh
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless=new --no-sandbox --disable-gpu --hide-scrollbars \
  --window-size=1440,900 --user-data-dir=/tmp/gm-shot --virtual-time-budget=12000 \
  --screenshot=/tmp/map.png "file:///path/to/map.html"
```

要看某个状态下的文案，复制一份 HTML 并在 `</body>` 前插入脚本，再用 `--dump-dom` 取渲染后的 DOM：

```python
src = open('map.html', encoding='utf-8').read()
js = """setTimeout(()=>{document.getElementById('tab-students').click();
  const q=document.getElementById('search'); q.value='某同学';
  q.dispatchEvent(new Event('input',{bubbles:true}));
  setTimeout(()=>{const b=document.querySelector('#list .list-row'); if(b) b.click();},500);},2600);"""
open('probe.html','w',encoding='utf-8').write(src.replace('</body>', f'<script>{js}</script></body>'))
```

随后 `--dump-dom` 输出整页，正则取 `id="detail-content"` 或 `#list` 的片段、去标签即可逐行核对。这比逐张截图更适合验证 50 行文案是否条条正确，因为它是文本而不是像素。

两个必须知道的限制：

- **`--window-size` 最小 500px。** 传 390 不会得到 390 的视口，浏览器按 500 排版后把画面裁到 390，看着像元素溢出右侧。要判断真实窄屏布局，用 500 宽截图，或改用 CDP 的 `Emulation.setDeviceMetricsOverride`。不要据被裁的截图判定移动端 bug。
- **headless 通常没有可用 WebGL**，页面会走内嵌 Leaflet 二维降级。这能证明降级路径可用，**不能**证明 3D 主视图正常；3D 需在有图形加速的浏览器里人工确认，报告中要分开写。

注入脚本会改变页面状态，验证完删掉副本，不要把它当成交付物。

## Optional bundled QA

The skill's `tests/browser.cjs` verifies the generated fictional demo, including the mobile gestures. Set `DEMO_HTML` to the generated fictional HTML. It needs Node.js, Playwright and a Chromium browser; these are development dependencies, not requirements for generating or opening the HTML.

From the standalone skill directory, optional local assembly is:

```sh
python3 scripts/validate_data.py --data examples/demo-data.json
python3 scripts/build.py --data examples/demo-data.json --output /tmp/graduation-demo.html
```

In a full development checkout, run Python unit tests and `node tests/model.cjs`. For browser QA use Node.js 20+, `npm ci`, `npx playwright install chromium`, then `DEMO_HTML=/tmp/graduation-demo.html npm run test:browser`. In the public repository root, prefix builder paths with `skills/graduation-map/`; its tests and npm package are at the repository root. An installed skill need not include development tests.

Also run `DEMO_HTML=/tmp/graduation-demo.html npm run test:compatibility` for the renderer-failure and mobile-resource checks.
