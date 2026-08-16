# Troubleshooting

Common issues when creating or validating Agent Plugins, and how to fix them.

## Manifest errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| `$schema must be ...` | Wrong or missing schema URL | Use exactly `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` |
| `name must be between 1 and 64` | Name too long/short | Keep 1-64 chars |
| `name may only contain lowercase...` | Uppercase or special chars | Use `a-z`, `0-9`, `-`, `.` |
| `must not contain consecutive hyphens` | `--` in name | Remove double hyphens |
| `unknown field ignored` | Extra top-level field | Move client-specific data under `extensions` |
| `Missing required property 'name'` | Empty manifest | Add required fields |

## Skill errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| `must start with ---` | Missing frontmatter | Add YAML frontmatter delimiters |
| `name ... must match the parent directory name` | Skill name ≠ folder name | Rename folder or change `name` |
| `required field description is missing` | No description | Add description (what + when) |
| `description must be at most 1024` | Too long | Shorten it |
| `allowed-tools contains invalid tool name` | Tool name with `/` or leading `_` | Use plain identifiers, space-separated |
| `unknown frontmatter field ... is ignored` | Typo or non-standard field | Remove it or move data under `metadata` |

## Packaging

| Symptom | Cause | Fix |
|---------|-------|-----|
| `plugin is not valid; run validate first` | Plugin fails validation | Run `node scripts/validate.js <root> --json`, fix reported errors, re-pack |
| `--verify` reports errors | Packed archive missing files referenced in configs | Re-check `--include` filters; referenced files are always required |

## Debugging tips

- Always validate after creating or editing: `node scripts/validate.js <plugin-root> --json`
- Use `--json` for machine-readable output
- Preview the archive contents without writing: `node scripts/pack.js <root> --dry-run`
- Verify a packed archive round-trips through validation: `node scripts/pack.js <root> --verify -o <dir>`
- Run the full regression suite after changing scripts: `npm test`
- A single failing component does not invalidate the whole plugin — fix it and re-validate
