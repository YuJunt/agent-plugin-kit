---
name: generate-notes
description: Produces polished release notes and changelog entries from categorized commit data. Use after analyzing commits to write user-facing release documentation.
---

# Generate Release Notes

Write a clean, user-focused release note from categorized commit analysis.

## When to use

- Drafting the release announcement or changelog section
- Turning analyzed commits into user-friendly notes
- Preparing notes for the project's README or a docs site

## Instructions

1. Take the categorized commit output from the `analyze-commits` skill (or the MCP `get_commit_log` result).
2. Rewrite each bullet to be user-facing:

   - Start with a verb in past tense: "Added", "Fixed", "Removed", "Improved", "Updated".
   - Drop internal jargon, ticket IDs, and author names.
   - Merge related bullets into one line where natural.

3. Order sections by importance: **Features**, **Bug fixes**, **Breaking changes**, **Improvements**, **Maintenance**.
4. Add a short summary paragraph at the top (2-3 sentences) describing the release theme.
5. Include migration notes for breaking changes.

## Output

```markdown
## v1.2.0 (YYYY-MM-DD)

This release adds ... and fixes ... .

### Features
- Added support for ...
- New command `...`

### Bug fixes
- Fixed ... when ...

### Breaking changes
- `...` now requires ... (migration: ...)

### Maintenance
- Upgraded dependencies ...
```

## Edge cases

- No features: lead with fixes or improvements instead.
- Breaking change without migration: call out that users must review it.
- Very long change list: group into "Highlights" and "Other changes".
