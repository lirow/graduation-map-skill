---
name: graduation-map
description: Use when turning a class graduation or college-admission list, a low-resolution destination image, or a corrected roster into a single-file interactive 3D map with province counts, school locations, and mobile gestures. Also applies to updating the roster or separating editable data from presentation. Not for tracking people's live locations.
---

# Graduation map

Create a shareable, editable class-destination HTML from a supplied roster or image. Work in the user's output directory; do not place private inputs inside this skill or its public example folder.

## Choose the entry point

- **Image:** crop dense regions and transcribe each row with a stable `id`, original row label, optional `sourceRect`, and confidence. Read [image-to-data.md](references/image-to-data.md). Enlarging pixels does not resolve ambiguous characters.
- **JSON / corrected names:** read [data-schema.md](references/data-schema.md). Apply authoritative corrections by `id`, preserving the original evidence. Recompute all counts.
- **Existing page:** retain its established appearance and behavior unless asked to redesign. The bundled template is a starting point for new pages, not a mandate to replace another implementation.

## Prepare the data

Use one student record per person and one school record per school/campus location. Students reference `schoolId`; schools own their location. Keep the class, mother school, schools, graduates, region-label configuration and map settings separate.

Distinguish three independent facts: name confidence, whether the attending campus is confirmed, and whether a representative coordinate is known. A known school center does not establish a historical campus. Use WGS84 longitude/latitude; do not mix GCJ-02 or BD-09 values with this basemap.

Unknown coordinates are `null`. A known province may contribute to its count without a school point. For ambiguous cross-province campuses, leave the actual destination region unresolved rather than choosing a headquarters. Keep overseas and unresolved records in the roster. Treat a source-image row count as the complete class size only after the user confirms completeness.

## Build a single file

Run the scripts with `--help` before adapting a command. Paths below are relative to this skill directory:

```sh
python3 scripts/validate_data.py --data /path/to/class.json
python3 scripts/build.py --data /path/to/class.json --output /path/to/class-map.html
```

Add `--source-image /path/to/source.jpg` only when the user wants that image embedded. The output then contains the full image and names; it is not anonymized by being a static file.

The resulting HTML puts editable `CLASS_INFO`, `ALMA_MATER`, `SCHOOLS`, `GRADUATES`, `REGION_CONFIG` and `MAP_CONFIG` before presentation code. Saving edits and refreshing rebuilds the view. Counts, labels, summaries, filters and JSON exports must all read the same objects.

## Verify the result

Read [verification.md](references/verification.md) for the focused checks: file opening offline, province/person accounting, null locations, labels, state changes, phone controls and touch gestures. School street detail is an optional online layer; distinguish that dependency from offline map functionality.

Inspect the rendered result and report which checks actually ran. For data edits, verify that the displayed names and exported JSON match the user's corrections. Preserve unknown information and give the user a short list of missing campus/address details.

## When publishing the workflow

Publication of a reusable skill does not imply permission to publish the class roster. Use a fresh, allowlisted public package with synthetic data, preserve third-party notices, and inspect files and Git history for private inputs. Read [publishing.md](references/publishing.md) when publication is requested. Publishing requires the user's authorization; ordinary map creation does not authorize a public repository.
