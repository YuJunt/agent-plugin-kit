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

## MCP errors

| Symptom | Cause | Fix |
|---------|-------|-----|
| `command must be a single executable token` | Shell command string like `npx -y foo` | Use bare name (`npx`) with `args` array, or a `./` plugin-relative path |
| `cwd must be a ./ plugin-relative path` | Bare path or `../` in cwd | Use `./data`, `${PLUGIN_ROOT}/data`, or `${PLUGIN_DATA}/data` |
| `non-loopback endpoints must use HTTPS` | `http://` for public host | Use `https://`; loopback-only for `http://` |
| `url must not contain user information` | `https://user:pass@host` | Remove credentials; auth is client-managed |
| `env must not contain reserved PLUGIN_ROOT or PLUGIN_DATA` | Reserved key in env | Remove; clients set these themselves |
| `$schema does not match plugin.json` | Version mismatch | Align both `$schema` values |

## Path safety

| Symptom | Cause | Fix |
|---------|-------|-----|
| `path resolves outside the plugin root` | `../` escape | All package paths must resolve within the root |
| `path escapes through a symlink` | Symlink pointing outside | Remove symlink or retarget inside the root |

## Packaging

| Symptom | Cause | Fix |
|---------|-------|-----|
| `plugin is not valid; run validate first` | Plugin fails validation | Run `node scripts/validate.js <root> --json`, fix reported errors, re-pack |

## Debugging tips

- Always validate after creating or editing: `node scripts/validate.js <plugin-root> --json`
- Use `--json` for machine-readable output
- A single failing component does not invalidate the whole plugin — fix it and re-validate
