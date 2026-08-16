# Reference: Manifest and Validation Semantics

Detailed reference for `plugin.json` and the Agent Plugins 1.0.0 validation rules. The [specification](https://agent-plugins.org/specification) is authoritative; this file summarizes what the bundled scripts check.

## Manifest schema

`plugin.json` is a closed JSON schema. Only these top-level fields are permitted:

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `$schema` | string | Yes | Must be `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json` |
| `name` | string | Yes | See naming constraints below |
| `version` | string | No | Semantic Versioning recommended |
| `description` | string | No | Short plugin purpose |
| `author` | object | No | Only `name`, `email`, `url` (strings) |
| `homepage` | string | No | Documentation URL |
| `repository` | string | No | Source repository URL |
| `license` | string | No | SPDX identifier recommended |
| `keywords` | string[] | No | Search/discovery tags |
| `extensions` | object | No | Client namespaces → objects |

Any other top-level field is a **schema violation**: clients report and ignore it (non-fatal). Other schema violations are **fatal** — the plugin is rejected.

## Plugin name constraints (§5.5)

- 1-64 characters
- Only `a-z`, `0-9`, `-`, `.`
- Must start and end with an alphanumeric character
- No consecutive hyphens (`--`) or consecutive periods (`..`)

Valid: `my-plugin`, `acme.tools`, `lint3r`, `a`
Invalid: `My-Plugin`, `-start`, `has--double`, `too.many..dots`, `""`

## Fatal vs non-fatal

| Condition | Result |
|-----------|--------|
| Missing/wrong `$schema` or `name` | Fatal: reject plugin |
| Other manifest schema violation | Fatal: reject plugin |
| Unknown top-level field | Non-fatal: report and ignore |
| `extensions` not an object | Non-fatal: report and ignore |
| `mcp.json` invalid | MCP disabled; other components continue |
| One invalid MCP server entry | Skip that server; others continue |
| One invalid skill | Skip that skill; others continue |

## Version matching

When `mcp.json` is present, its `$schema` value must match `plugin.json`'s `$schema`. A mismatch disables MCP only.

## Path containment (§4.1)

- Plugin-relative config paths must begin with `./`
- All package paths must resolve within the plugin root (no `..` escapes, no symlink escapes)
- `mcp.json` `command`/`cwd` failing containment invalidates that server entry only
