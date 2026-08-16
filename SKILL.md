---
name: agent-plugin-kit
description: Creates, validates, and packages Agent Plugins per the Agent Plugins 1.0.0 specification. Use when building, scaffolding, validating, or packaging agent plugins that contain Agent Skills or MCP servers, or when the user mentions Agent Plugins, plugin.json, mcp.json, or plugin packaging.
license: MIT
compatibility: Requires Node.js 18+ (scripts use only built-in modules, no npm dependencies)
metadata:
  author: YuJunt
  version: "1.0.0"
---

# Agent Plugin Kit

This skill turns your AI agent into an Agent Plugins development tool. It helps you **create**, **validate**, and **package** Agent Plugins that conform to the [Agent Plugins 1.0.0 specification](https://agent-plugins.org/specification).

An Agent Plugin is a self-contained directory with a `plugin.json` manifest and optional components (Agent Skills in `skills/`, MCP servers in `mcp.json`). One package works across compatible clients (ChatGPT, Codex, Cursor, GitHub Copilot, VS Code, Kiro).

## When to use this skill

- User wants to scaffold a new Agent Plugin
- User wants to validate an existing plugin directory against the 1.0.0 spec
- User wants to package a plugin for distribution
- User asks about plugin structure, manifest fields, or MCP configuration

## Core workflow

Run the bundled Node.js scripts from the skill root. All scripts are zero-dependency (built-in modules only) and print JSON for reliable parsing.

1. **Create** a plugin skeleton:
   ```
   node scripts/create.js <plugin-name> --full -d <output-dir>
   ```
   Options: `--full` (complete skeleton with skills + mcp + LICENSE), `--minimal` (plugin.json + skills placeholder), `-s/--skills`, `-m/--mcp`, `-d/--dir`.

2. **Validate** a plugin directory:
   ```
   node scripts/validate.js <plugin-root> --json
   ```
   Exit code 0 = valid. The report covers manifest, skills, MCP config, and path safety.

3. **Package** a plugin:
   ```
   node scripts/pack.js <plugin-root> -o <output-dir>
   ```
   Produces `<name>-<version>.tgz`.

## Plugin structure (the portable contract)

```text
my-plugin/
├── plugin.json           # REQUIRED manifest
├── skills/               # Agent Skills, one subdirectory per skill
│   └── summarize/
│       ├── SKILL.md
│       ├── scripts/
│       └── references/
├── mcp.json              # MCP server configuration (optional)
└── com.example.client/   # Client-specific extension namespace (optional)
```

### plugin.json rules

- Only these top-level fields are allowed: `$schema`, `name`, `version`, `description`, `author`, `homepage`, `repository`, `license`, `keywords`, `extensions`. Unknown fields are reported and ignored.
- Required: `$schema` (must be `https://agent-plugins.org/schemas/1.0.0/plugin.schema.json`) and `name`.
- Plugin name: 1-64 chars, only `a-z`, `0-9`, `-`, `.`; must start/end alphanumeric; no `--` or `..`.

### skills/ rules

- Skills are discovered at `skills/<name>/SKILL.md` (immediate children only, no recursion).
- `SKILL.md` requires YAML frontmatter with `name` and `description`. Skill `name` must match its parent directory and the Agent Skills naming rules.

### mcp.json rules

- Must be `{"$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json", "mcpServers": {...}}`.
- Each server entry has a `type`: `stdio`, `streamable-http`, or `sse`.
- `stdio` fields: `command` (single token, bare name or `./` plugin-relative path), `args`, `env`, `cwd`. `args`/`env`/`cwd` support `${PLUGIN_ROOT}` and `${PLUGIN_DATA}`.
- `streamable-http`/`sse` fields: `url` (absolute http/https, loopback-only http), `headers`.
- The `$schema` version must match `plugin.json`'s version.

## Detailed reference

Load the following files as needed (progressive disclosure — keep SKILL.md lean):

- [references/REFERENCE.md](references/REFERENCE.md) — Full manifest field reference and validation semantics
- [references/MCP_GUIDE.md](references/MCP_GUIDE.md) — MCP server configuration, transports, and placeholder rules
- [references/SKILL_WRITING.md](references/SKILL_WRITING.md) — Writing valid Agent Skills for the `skills/` directory
- [references/TROUBLESHOOTING.md](references/TROUBLESHOOTING.md) — Common errors and how to fix them

## Best practices

- Always validate after creating or editing a plugin: `node scripts/validate.js <plugin-root> --json`.
- Use `--full` when the plugin will contain both skills and MCP servers; otherwise add components with `-s`/`-m`.
- Plugin-relative paths in configs must start with `./`. Use `${PLUGIN_ROOT}` for bundled files and `${PLUGIN_DATA}` for writable state.
- Never embed credentials in `mcp.json` headers or env values (they are visible package data).
- A component failure is isolated: one invalid skill or MCP server does not invalidate the whole plugin. Fix and re-validate.

## Examples

The [examples/hello-plugin](examples/hello-plugin) directory is a complete valid plugin. Use it as a reference and as a test fixture:
```
node scripts/validate.js examples/hello-plugin --json
```
