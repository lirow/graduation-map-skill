# Image to trustworthy records

Use this when the source is a low-resolution admission/destination diagram.

1. Inspect the original pixel dimensions. Crop one table/region at a time, enlarge it, and compare visual reading with an available OCR engine. Do not upload private images to a service unless authorized. Do not use generative upscaling as evidence for a person's name.
2. Assign stable IDs immediately. Keep `sourceLabel` (such as a region and row number) and `sourceRect: [x,y,width,height]` in original-image pixels. Two independent readings are useful for dense columns. Count rows separately from reading names.
3. Separate confidence: a school can be readable while a name is not. Store the uncertain name with `□` and `nameStatus: "needs_review"`; keep alternatives in `nameCandidates`. Do not silently promote an OCR candidate to a confirmed identity.
4. Reconcile each region's row count with the complete transcribed roster. Shared schools produce one point with several students, not fewer people. Do not force the count to match an earlier rough estimate.
5. Give the user a correction sheet keyed by stable ID, including the school and source row for context. Accept later user corrections as authoritative; preserve `ocrName` or original evidence when useful. The importer accepts `id,name` CSV, not positional row replacement.

## Schools and historical campuses

Keep source-era school names unless the user asks to normalize them. A renamed institution can have an alias and an `identitySource`; that does not prove which campus a student attended. Prefer official institution/address evidence and public map features for geocoding. Store both the coordinate source and the campus confirmation status.

A supplied address can establish the intended campus. Geocode it separately; verify the result is a campus element at that address, not an unrelated institution with the same name. Record the coordinate system. Leave unresolved coordinates null rather than inventing a city-center school point.

Do not search for classmates' private details. The task needs the provided roster and public institution information.
