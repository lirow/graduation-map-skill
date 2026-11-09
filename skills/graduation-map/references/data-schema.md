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
| `meta` | `className`, `year`, `homeCountry`, `rosterComplete`, `isDemo` | Class identity and declared completeness. Do not store derived counts. |
| `origin` | `name`, `campus`, `address`, `lng`, `lat`, `campusStatus` | Mother school, or `null` when unknown. |
| `schools[]` | unique `id`, `name`, `country`, `province`, `city`, `campus`, `lng`, `lat` | One destination location per record. A second campus gets its own ID. |
| `students[]` | unique `id`, `name`, `schoolId`, `nameStatus` | A person refers to a school ID; use `schoolId: null` when unresolved. |
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
- Other campus states retain the “school reference location” explanation. `coordinateStatus: "campus_confirmed"` is also recognized for compatibility; avoid using it to claim that a surveyed exact position was verified.
- `isDemo: true` labels the entire example as fictional. Use invented names and associations in public examples.

The generated variables are `CLASS_INFO`, `ALMA_MATER`, `SCHOOLS`, `GRADUATES`, `REGION_CONFIG` and `MAP_CONFIG`, combined by reference in `CLASS_MAP_DATA`. The pure data model builds indexes and counts without mutating them. Editing and refreshing the HTML updates the presentation; it is not a live database.

`schoolCount` counts referenced school/campus records. It is not a ranking and may differ from the number of distinct institutional names if campuses are split. `located` counts students with a known point; unlocated students remain in total counts and lists.

Mother-school routes start enabled when the mother school has valid coordinates. Use `map.showRoutes: false` to start with them hidden. Missing mother-school coordinates disable the switch and do not create a route. Switching regions or returning to the overview preserves the viewer's current toggle choice.

Street detail attempts to enable automatically using `streetsSourceUrl`. Offline or inaccessible source/tile data quietly leaves the embedded map active; connectivity recovery retries unless the viewer manually switched streets off. There is no network status toast or blocking prompt.

> Maintenance: The data contract retains current records only; source comparison/evidence fields are no longer part of the delivered map.
