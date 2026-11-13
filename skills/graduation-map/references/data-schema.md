---
type: 技能参考
scope: skills-on-demand / 生活 / graduation-map
updated: 2026-11-08
tags: [skill, graduation-map]
tldr: "graduation-map 的 data-schema 参考说明。"
---

# Data contract

This is the page/optional builder contract after the agent analyzes the user's sources; users do not have to prepare JSON. The builder accepts one UTF-8 JSON object with required `meta`, `schools` and `students`; map settings and region overrides can use defaults. The runnable fictional example is in `../examples/demo-data.json`.

| Object | Key fields | Meaning |
|---|---|---|
| `meta` | `className`, `year`, `homeCountry`, `rosterComplete`, `isDemo`, `statusLabels`, `unknownLabel` | Class identity and declared completeness. Do not store derived counts. |
| `origin` | `name`, `campus`, `address`, `lng`, `lat`, `campusStatus` | Mother school, or `null` when unknown. |
| `schools[]` | unique `id`, `name`, `country`, `province`, `city`, `campus`, `lng`, `lat` | One destination location per record. A second campus gets its own ID. |
| `students[]` | unique `id`, `name`, `schoolId`, `nameStatus`, `status` | A person refers to a school ID; use `schoolId: null` when unresolved. |
| `regions[]` | `name`, `shortName`, `centroid`, `isCountry`, `geoName` | Optional label anchors/geometry aliases, especially for foreign countries. |
| `map` | `showRoutes`, camera limits, zoom thresholds, glyph/tile URLs | Optional presentation/resource settings. `showRoutes` defaults to `true`; the layer-panel switch controls it during viewing. |

Keep current business values and their confirmation/unknown states. Do not add source-image crops, source labels/links, OCR history or proof notes. The builder and correction helper strip obsolete source/evidence fields from older inputs without changing their input files. Do not set `user_confirmed` merely because a file was read successfully.

Before generating, show all student, school/location, class and mother-school data for manual review. After user corrections, show the complete revised version and obtain explicit confirmation; see [reconciliation.md](reconciliation.md).

## Location and confirmation

- Coordinates are numeric WGS84 longitude/latitude. Both values must be provided together or both be `null`.
- With a valid `schoolId`, the school's region is authoritative. Avoid duplicating that region on every student. A student without a school may carry a known `province` and `country` as fallback data.
- `nameStatus: "user_confirmed"` means the user corrected/confirmed the name; it does not confirm the campus.
- `nameStatus: "needs_review"` preserves uncertain characters.
- `campusStatus: "user_confirmed"` means the attending campus was confirmed by the user.
- `campusStatus: "source_confirmed"` means the source explicitly identifies the attending campus.
- `campusStatus: "assumed"` means the campus is inferred from the school's main campus because the source named only the institution and the user accepted that convention. The page words it as "按学校主校区推定" and keeps these records out of the "尚待确认" count, so a batch of inferred campuses does not read as unfinished work.
- Other campus states retain the “school reference location” explanation. `coordinateStatus: "campus_confirmed"` is also recognized for compatibility; avoid using it to claim that a surveyed exact position was verified.
- `isDemo: true` labels the entire example as fictional. Use invented names and associations in public examples.

The generated variables are `CLASS_INFO`, `ALMA_MATER`, `SCHOOLS`, `GRADUATES`, `REGION_CONFIG` and `MAP_CONFIG`, combined by reference in `CLASS_MAP_DATA`. The pure data model builds indexes and counts without mutating them. Editing and refreshing the HTML updates the presentation; it is not a live database.

## Wording belongs in the data, not in `app.js`

A class sometimes needs its unresolved rows phrased its own way — repeating students may need to read as "待定" so they are not singled out, while genuinely blank rows stay "待补充". Both look unremarkable to a reader and stay distinguishable to the teacher who asked. Do not fork the assets to change this; configure it:

```json
"meta": {
  "statusLabels": { "pending": "去向待定", "blank": "去向待补充" },
  "unknownLabel": "去向待确认"
}
```

- `students[].status` selects a label from `meta.statusLabels`. A missing or unmapped status falls back to "去向待补充", so older data keeps working.
- `meta.unknownLabel` renames the single aggregate counter used in the header and the about panel. Every unresolved student stays inside that one number, which keeps the group's size from being readable off the page.

When the wording really cannot be expressed as data, `build.py --assets <dir>` points the build at an alternative `assets/` tree (containing `runtime/`, `vendor/`, `geo/`) instead of copying the whole skill.

## Getting WGS84 coordinates

Chinese POI sources return GCJ-02 (Tencent, Amap) or BD-09 (Baidu). Feeding either into this map shifts every point by 100–700 m with no visible error, which is exactly the kind of mistake that survives review. Convert with the bundled helper:

```sh
python3 scripts/coord.py --from gcj --to wgs --lat 30.61 --lng 103.98
python3 scripts/coord.py --from gcj --to wgs --file points.json   # batch; keeps other keys, adds shiftMeters
python3 scripts/coord.py --selftest
```

`--selftest` checks forward/inverse round trip, a known point, the expected offset band and out-of-China passthrough. Run it after touching the module.

Prefer sources that name the campus explicitly (official site, admissions charter) over the school's headquarters, and copy the full address into `address`. Then check plausibility with `validate_data.py --report`: it lists every school's distance to the mother school, and a point hundreds of kilometres from what its city implies is usually a wrong campus or a wrong name match.

`schoolCount` counts referenced school/campus records. It is not a ranking and may differ from the number of distinct institutional names if campuses are split. `located` counts students with a known point; unlocated students remain in total counts and lists.

Mother-school routes start enabled when the mother school has valid coordinates. Use `map.showRoutes: false` to start with them hidden. Missing mother-school coordinates disable the switch and do not create a route. Switching regions or returning to the overview preserves the viewer's current toggle choice.

Street detail attempts to enable automatically using `streetsSourceUrl`. Offline or inaccessible source/tile data quietly leaves the embedded map active; connectivity recovery retries unless the viewer manually switched streets off. There is no network status toast or blocking prompt.

> Maintenance: The data contract retains current records only; source comparison/evidence fields are no longer part of the delivered map.
