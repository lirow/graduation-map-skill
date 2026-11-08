# Publishing the reusable workflow

Use this only when the user has requested public distribution.

Create a separate clean repository or explicit file allowlist. Include the skill, generic scripts/template, synthetic example, tests and license notices. Do not copy an entire working folder that contains source photos, correction sheets, exports, backups or version history with private records.

Before the first push:

1. Inspect tracked files and diffs. Search for known private names, school/class identifiers, personal addresses, home-directory paths, tokens, original image data and copied backups. Inspect screenshots visually.
2. Build the synthetic demo from a directory outside the skill folder. Verify that commands do not depend on one machine's absolute paths or private files.
3. Run the supported skill validator and the relevant code/browser tests. A frontmatter pass does not establish functional correctness.
4. Preserve MapLibre's distribution notices and Natural Earth's source/processing notes. State which features work offline and which request online tiles.
5. Push only the reviewed content to the user-authorized account/repository. Check the actual repository visibility and remote commit afterwards; do not claim public publication from a local commit alone.

Keep real maps private unless the user separately authorizes publishing those specific contents. A published HTML contains its JSON and any embedded original image even when the UI hides them.
