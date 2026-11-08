# Data contract

The builder accepts one UTF-8 JSON object. Required collections are `schools` and `students`; the map settings and region overrides can be omitted to use the bundled defaults. The exact minimal example is in the public repository's `examples/demo-data.json`.

| Object | Key fields | Meaning |
|---|---|---|
| `meta` | `className`, `year`, `homeCountry`, `rosterComplete`, `isDemo` | Class identity and declared completeness. Do not store derived counts. |
| `origin` | `name`, `campus`, `address`, `lng`, `lat`, `campusStatus` | Mother school, or `null` when unknown. |
| `schools[]` | unique `id`, `name`, `country`, `province`, `city`, `campus`, `lng`, `lat` | One destination location per record. A second campus gets its own ID. |
| `students[]` | unique `id`, `name`, `schoolId`, `nameStatus` | A person refers to a school ID; use `schoolId: null` when unresolved. |
| `regions[]` | `name`, `shortName`, `centroid`, `isCountry`, `geoName` | Optional label anchors/geometry aliases, especially for foreign countries. |
| `map` | camera limits, zoom thresholds, glyph/tile URLs | Optional presentation/resource settings. |

Optional evidence fields include `coordinateNote`, `locationSource`, `identitySource`, `sourceLabel`, `sourceRect`, `reviewNote`, `nameCandidates` and `ocrName`.

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
