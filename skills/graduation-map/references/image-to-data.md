---
type: 技能参考
scope: skills-on-demand / 生活 / graduation-map
updated: 2026-11-08
tags: [skill, graduation-map]
tldr: "graduation-map 的 image-to-data 参考说明。"
---

# Image to trustworthy records

Use this when the source is a low-resolution admission/destination diagram.

1. Inspect the original pixel dimensions. Crop one table/region at a time, enlarge it, and compare visual reading with an available OCR engine. Do not upload private images to a service unless authorized. Do not use generative upscaling as evidence for a person's name.
2. Assign stable IDs immediately. Read dense columns independently when useful. Count rows separately from reading names; do not retain crop coordinates or per-row source records after reading.
3. Separate confidence: a school can be readable while a name is not. Store the uncertain name with `□` and `nameStatus: "needs_review"`. Ask the user to supply the correct characters rather than keeping OCR history.
4. Reconcile each region's row count with the complete transcribed roster. Shared schools produce one point with several students, not fewer people. Do not force the count to match an earlier rough estimate.
5. Present every student and school/location record for manual review, keyed by stable ID. Accept user edits, display the complete updated version and wait for explicit confirmation before generating HTML. The optional importer accepts `id,name` CSV, not positional row replacement; it does not supply full-data confirmation.

## Schools and historical campuses

Keep source-era school names unless the user asks to normalize them. A renamed institution can have an alias; that does not establish which campus a student attended. Use official institution/address information and public map features for geocoding. Keep the current location and campus confirmation status without archiving research links.

A supplied address can establish the intended campus. Geocode it separately; verify the result is a campus element at that address, not an unrelated institution with the same name. Record the coordinate system. Leave unresolved coordinates null rather than inventing a city-center school point.

Do not search for classmates' private details. The task needs the provided roster and public institution information.

> Maintenance: Source-image comparison and evidence retention were removed; retain current data and the full-data user confirmation step.
