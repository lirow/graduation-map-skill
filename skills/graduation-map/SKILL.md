---
name: graduation-map
metadata:
  tldr: "Agent 根据图片、文本、表格、对话或混合资料分析校对，交付可离线打开的毕业去向单页地图。"
description: Use when a user wants a graduation or college-admission destination map from images, TXT, Excel/CSV, PDF/Word, chat messages, web tables, or mixed rosters, or wants to correct an existing class map. Not for tracking people's live locations.
---

# Graduation map

You are the analyst and map author. Read the user's sources, list all analyzed data for user review, and generate a shareable, editable HTML only after the user confirms that version. The user may attach files, paste text, provide a permitted link or point to a local folder; do not require them to transcribe an image, prepare JSON, or run a pipeline. Choose available reading tools and use bundled helpers only where useful. Work in the user's output directory; keep private inputs outside this skill and public examples.

## Read and reconcile the sources

Read [input-sources.md](references/input-sources.md) for the supplied formats: image/OCR, TXT/Markdown, Excel/CSV, conversation, PDF/Word, authorized web/form exports, structured data and mixed folders. It defines splitting, sheet roles and tool fallbacks. For images also read [image-to-data.md](references/image-to-data.md); enlarging pixels does not resolve ambiguous characters.

Read [reconciliation.md](references/reconciliation.md) before merging or applying corrections. Assign stable person IDs, distinguish detail from summaries, preserve same-name people, and avoid double counting.

## List all data and wait for confirmation

After analysis, present the complete student roster (ID, name, school, campus, country/province/city, destination status and unknown fields), the complete school/location table (including addresses and WGS84 coordinates), mother-school/class settings and counts. Show every record, not just samples or uncertainties. For long lists, provide a readable complete table file plus counts in chat.

Ask the user to check and manually correct any errors, either by editing the table or by replying with ID/field/new value. Stop before building any HTML, including a draft, until the user explicitly confirms the displayed version. Reading a file successfully, a request to “make a map”, no visible ambiguities or silence is not confirmation. After any correction, show the full updated data and wait for confirmation again. A user can explicitly accept unknown fields; keep them unknown rather than filling them by guesswork. A later data change requires review of its updated version too.

Keep only the current business data after reading. Do not require source IDs, row/crop references, OCR history, evidence archives or a separate proof report. The generated page and exports must not include source images, comparison dialogs, provenance links or obsolete evidence fields. Do not delete the user's original input files.

Read [data-schema.md](references/data-schema.md) to map the analyzed records into the page contract. JSON is an agent working format, not a prerequisite for the user. For an existing page retain its established appearance and behavior unless asked to redesign.

## Prepare the data

Use one student record per person and one school record per school/campus location. Students reference `schoolId`; schools own their location. Keep the class, mother school, schools, graduates, region-label configuration and map settings separate.

Distinguish three independent facts: name confidence, whether the attending campus is confirmed, and whether a representative coordinate is known. A known school center does not establish a historical campus. Use WGS84 longitude/latitude; do not mix GCJ-02 or BD-09 values with this basemap.

Unknown coordinates are `null`. A known province may contribute to its count without a school point. For ambiguous cross-province campuses, leave the actual destination region unresolved rather than choosing a headquarters. Keep overseas and unresolved records in the roster. Treat a source-image row count as the complete class size only after the user confirms completeness.

## Build a single file

Adapt the bundled template or generate a compatible page with your available tools. The following helpers are optional local validation/assembly tools, not readers for arbitrary source files or replacements for your analysis. Run `--help` before adapting a command; paths are relative to this skill:

```sh
python3 scripts/validate_data.py --data /path/to/class.json
python3 scripts/build.py --data /path/to/class.json --output /path/to/class-map.html
```

The resulting HTML puts editable `CLASS_INFO`, `ALMA_MATER`, `SCHOOLS`, `GRADUATES`, `REGION_CONFIG` and `MAP_CONFIG` before presentation code. Saving edits and refreshing rebuilds the view. Counts, labels, summaries, filters and JSON exports must all read the same objects.

Street detail should attempt to enable automatically when its service is reachable. Use the actual source request, not only `navigator.onLine`; fail quietly to the embedded map on offline, timeout or source/tile failure, and retry on connectivity recovery. Do not add network prompts, failure banners or toasts. Keep a viewer's manual off choice until they re-enable it.

Keep the embedded Leaflet 2D renderer as an independent fallback when WebGL, workers or the 3D engine fail. Limit mobile rendering cost, automatically recover from slow startup/context loss, and clear obsolete error overlays after successful initialization. Read [compatibility.md](references/compatibility.md) for the capability-based policy and the limits of Xiaomi-related evidence.

## Verify the result

Read [verification.md](references/verification.md) for the focused checks: file opening offline, province/person accounting, null locations, labels, state changes, phone controls and touch gestures. School street detail is an optional online layer; distinguish that dependency from offline map functionality.

Inspect the rendered result and report which checks actually ran. For data edits, verify that the displayed names and exported JSON match the user's corrections. Preserve unknown information and give the user a short list of missing campus/address details.

With no real sources, explain the supported analysis and optionally use explicitly fictional examples. Never claim that TXT/Excel parsing, a roster or a real cohort was verified without the corresponding input.

## When publishing the workflow

Publication of a reusable skill does not imply permission to publish the class roster. Use a fresh, allowlisted public package with synthetic data, preserve third-party notices, and inspect files and Git history for private inputs. Read [publishing.md](references/publishing.md) when publication is requested. Publishing requires the user's authorization; ordinary map creation does not authorize a public repository.

> Maintenance: The full-data review and explicit confirmation precede generation. Source comparison and evidence archiving were removed at the user's request; keep only current business data. Source reading guidance lives in the linked references; scripts remain optional assembly aids.
