# Reference: Writing Agent Skills for a Plugin

How to author valid Agent Skills under the plugin's `skills/` directory, per the [Agent Skills specification](https://agentskills.io/specification).

## Directory layout

```text
skills/
└── <skill-name>/
    ├── SKILL.md        # required: frontmatter + instructions
    ├── scripts/        # optional executable code
    ├── references/     # optional documentation
    └── assets/         # optional templates/resources
```

Each immediate child of `skills/` containing a `SKILL.md` file is one skill. Deeper nesting is not scanned.

## SKILL.md frontmatter

| Field | Required | Constraints |
|-------|----------|-------------|
| `name` | Yes | 1-64 chars; lowercase letters, digits, hyphens only; no leading/trailing hyphen; no `--`; must equal the parent directory name |
| `description` | Yes | 1-1024 chars; describe what it does AND when to use it |
| `license` | No | License name or bundled license file reference |
| `compatibility` | No | Environment requirements (max 500 chars) |
| `metadata` | No | map of string → string |
| `allowed-tools` | No | Space-separated pre-approved tools (experimental) |

## Body

Write step-by-step instructions, input/output examples, and edge cases. Keep `SKILL.md` under ~500 lines; move detail to `references/` and `scripts/`.

## Progressive disclosure

Agents load skills progressively:
1. Metadata (`name` + `description`) loaded at startup
2. Full `SKILL.md` body loaded on activation
3. `scripts/`, `references/`, `assets/` loaded on demand

Keep the main file lean so activation stays cheap.

## Naming example

```markdown
---
name: summarize
description: Summarize long documents into concise bullet points. Use when the user asks to summarize reports, articles, or meeting notes.
---

# Summarize

Steps to produce a good summary...
```

## Validation

This kit's validator checks each discovered `SKILL.md`: frontmatter presence, required fields, name rules, and name-directory match. A skill that fails is skipped without affecting other components.
