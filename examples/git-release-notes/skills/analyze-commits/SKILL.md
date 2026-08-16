---
name: analyze-commits
description: Analyzes git commit history to categorize changes by type (features, fixes, breaking, maintenance). Use when generating release notes, changelogs, or reviewing what changed between versions.
---

# Analyze Commits

Categorize git commits between two refs into release-note sections.

## When to use

- Preparing a release or changelog
- Summarizing what changed in a version range
- Reviewing contributions before tagging a release

## Instructions

1. Determine the ref range (default: latest tag → `HEAD`, or `HEAD~N` → `HEAD`).
2. Run the MCP `get_commit_log` tool with the range, or run `git log --format=... <range>` directly.
3. Classify each commit by prefix when present, otherwise by message keywords:

| Category | Triggers |
|----------|----------|
| Features | `feat`, `feature`, `add`, "new" |
| Bug fixes | `fix`, `bug`, `hotfix`, `resolve` |
| Breaking changes | `breaking`, `BREAKING CHANGE`, `!` suffix (e.g. `feat!`) |
| Maintenance | `chore`, `refactor`, `docs`, `test`, `build`, `ci`, `style`, `perf` |

4. Group commits within each category, keeping the original subject line.
5. Drop trivial commits (typos, reverts of reverts) unless requested.

## Output

```text
## [Unreleased] (or <version>)

### Features
- ...

### Bug fixes
- ...

### Breaking changes
- ...

### Maintenance
- ...
```

## Edge cases

- Empty range: report "no commits in range".
- No conventional prefixes: classify by message keywords and flag the category as inferred.
- Merge commits: use the merged branch's summary when the subject is unhelpful.
