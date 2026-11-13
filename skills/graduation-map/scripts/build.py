#!/usr/bin/env python3
"""Build one self-contained graduation-map HTML from confirmed local JSON.

Python standard library only. The build never downloads resources or uploads data.
Core maps work offline; optional detailed street maps require network access.
"""
import argparse
import base64
import html
import json
from pathlib import Path
import re
import sys
from data_tools import DataError, load_json, normalized_data

SKILL_ROOT = Path(__file__).resolve().parents[1]
ASSETS = SKILL_ROOT / "assets"


def safe_json(value, indent=None):
    return json.dumps(value, ensure_ascii=False, indent=indent, allow_nan=False,
                      separators=None if indent else (",", ":")).replace("<", "\\u003c").replace("\u2028", "\\u2028").replace("\u2029", "\\u2029")


def editable_data(data):
    result = """// ==================== 页面业务数据：可直接编辑 ====================
// 修改后保存 HTML 并刷新即可；展示逻辑会重新计算统计与地图标记。
// GRADUATES.schoolId 引用 SCHOOLS.id；同校不同校区使用不同学校/校区 id。
// 坐标统一为 WGS84 lng/lat；无法确认的位置填 null，不用省会代替。
// 不要手填人数、地区人数或学校数；这些统计均由名单派生。
"""
    for name, key, label in (
        ("CLASS_INFO", "meta", "班级、年份、名单完整性"),
        ("ALMA_MATER", "origin", "母校、校区、地址、坐标及确认状态"),
        ("SCHOOLS", "schools", "学校/校区：id 必须唯一"),
        ("GRADUATES", "students", "毕业生：姓名、schoolId 与当前数据状态"),
        ("REGION_CONFIG", "regions", "可选地区标签位置配置"),
        ("MAP_CONFIG", "map", "地图视角与可选在线底图配置"),
    ):
        result += f"\n// {label}\nconst {name} = {safe_json(data[key], indent=2)};\n"
    return result + """
const CLASS_MAP_DATA = {
  meta: CLASS_INFO,
  origin: ALMA_MATER,
  schools: SCHOOLS,
  students: GRADUATES,
  regions: REGION_CONFIG,
  map: MAP_CONFIG
};
window.CLASS_MAP_DATA = CLASS_MAP_DATA;
// ==================== 业务数据区结束 ====================
"""


def script_text(path):
    value = path.read_text(encoding="utf-8")
    value = re.sub(r"//# sourceMappingURL=.*", "", value)
    return re.sub(r"</script", lambda match: "<\\/" + match[0][2:], value, flags=re.I)


def leaflet_css(vendor):
    root = vendor / "leaflet"
    return re.sub(
        r"url\(images/([a-zA-Z0-9.-]+)\)",
        lambda match: "url(data:image/png;base64," + base64.b64encode((root / "images" / match[1]).read_bytes()).decode("ascii") + ")",
        (root / "leaflet.css").read_text(encoding="utf-8"),
    )


def build_html(data, assets=None):
    """Return the rendered HTML without writing files or modifying input data."""
    data = normalized_data(data)
    root = Path(assets).resolve() if assets else ASSETS
    runtime, vendor, geo = (root / name for name in ("runtime", "vendor", "geo"))
    template = (runtime / "page.html").read_text(encoding="utf-8")
    replacements = {
        "/*__MAP_CSS__*/": (vendor / "maplibre-gl.css").read_text(encoding="utf-8"),
        "/*__MAP_JS__*/": script_text(vendor / "maplibre-gl.js"),
        "/*__FALLBACK_CSS__*/": leaflet_css(vendor),
        "/*__FALLBACK_JS__*/": script_text(vendor / "leaflet" / "leaflet.js"),
        "/*__MAP_ADAPTER_JS__*/": script_text(runtime / "offline-map.js"),
        "/*__APP_JS__*/": script_text(runtime / "app.js"),
        "/*__DATA_MODEL_JS__*/": script_text(runtime / "data-model.js"),
        "/*__EDITABLE_DATA__*/": editable_data(data),
        "/*__PROVINCE_GEO__*/": safe_json(load_json(geo / "china-provinces.json")),
        "/*__WORLD_GEO__*/": safe_json(load_json(geo / "world.json")),
        "/*__LICENSE__*/": html.escape((vendor / "LICENSE.txt").read_text(encoding="utf-8") + "\n\nLeaflet 1.9.4\n" + (vendor / "leaflet" / "LICENSE").read_text(encoding="utf-8")),
        "/*__GEO_SOURCES__*/": html.escape((geo / "sources.txt").read_text(encoding="utf-8")).replace("\n", "<br>"),
    }
    for marker in replacements:
        if template.count(marker) != 1:
            raise DataError(f"Expected exactly one template marker: {marker}")
    # Substitute the original template once, so user data containing a marker
    # cannot accidentally trigger another substitution.
    marker_pattern = re.compile("|".join(re.escape(marker) for marker in replacements))
    return marker_pattern.sub(lambda match: replacements[match[0]], template)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", required=True, help="Input UTF-8 JSON with meta, schools and students. origin may be null; map and regions are optional.")
    parser.add_argument("--output", required=True, help="Explicit destination .html path. Existing output is replaced; input/assets cannot be used as output.")
    parser.add_argument("--assets", help="Optional alternative assets directory (must contain runtime/, vendor/ and geo/). Defaults to the bundled assets; use it to customise wording without forking the whole skill.")
    args = parser.parse_args(argv)
    try:
        assets = Path(args.assets).resolve() if args.assets else ASSETS
        output = Path(args.output).resolve()
        protected = {Path(args.data).resolve()}
        if output in protected or output == assets or assets in output.parents:
            raise DataError("Output must differ from input files and bundled assets.")
        if output.suffix.lower() not in (".html", ".htm"):
            raise DataError("Output must use an .html or .htm extension.")
        rendered = build_html(load_json(args.data), assets=assets)
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text(rendered, encoding="utf-8")
    except (DataError, OSError, ValueError) as error:
        print(f"Build failed: {error}", file=sys.stderr)
        return 1
    print(f"Built {output} ({len(rendered.encode('utf-8')):,} bytes). No network requests were made during build.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
