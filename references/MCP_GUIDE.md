# Reference: MCP Servers in Agent Plugins

How to configure MCP servers in `mcp.json` per Agent Plugins 1.0.0 (§7.2, §9).

## Structure

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "server-name": { "...": "..." }
  }
}
```

Only these two top-level fields are allowed. `mcpServers` may be empty. The `$schema` must match `plugin.json`.

## Transports

### stdio (local process)

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | `"stdio"` |
| `command` | Yes | Single executable token: a bare name (`npx`) or a plugin-relative path (`./bin/server`) |
| `args` | No | string[]; supports `${PLUGIN_ROOT}` / `${PLUGIN_DATA}` expansion |
| `env` | No | object of strings; supports placeholder expansion |
| `cwd` | No | Must be `./`-relative, or rooted at `${PLUGIN_ROOT}` / `${PLUGIN_DATA}` |

Rules:
- `command` must be one token — never a shell command string.
- Bundled executables must use a `./` plugin-relative path.
- `env` must NOT contain `PLUGIN_ROOT` or `PLUGIN_DATA` keys (reserved).

### streamable-http (remote)

| Field | Required | Description |
|-------|----------|-------------|
| `type` | Yes | `"streamable-http"` |
| `url` | Yes | Absolute HTTP(S) URL; no userinfo, no fragment; non-loopback must be HTTPS; no placeholders — clients never expand `${PLUGIN_ROOT}`/`${PLUGIN_DATA}` in `url` |
| `headers` | No | object of strings; names must be valid HTTP field names (RFC 9110 token), values must not contain control characters or leading/trailing whitespace, no duplicate names under different casing |

### sse (legacy HTTP+SSE)

Same shape as `streamable-http` with `"type": "sse"`. Deprecated transport from MCP 2024-11-05.

## Environment variables (§9)

Clients launch stdio subprocesses with two reserved variables:

- `PLUGIN_ROOT` — absolute path to the installed plugin root
- `PLUGIN_DATA` — absolute path to a client-managed writable data directory (persists across updates)

Use `PLUGIN_ROOT` for bundled files, `PLUGIN_DATA` for state/dependencies/caches.

## Placeholder expansion (§9.2)

Only `${PLUGIN_ROOT}` and `${PLUGIN_DATA}` are expanded, and only in `args`, `env` values, and `cwd`. Expansion is single-pass and non-recursive. Unknown placeholder-like text stays literal.

## Secrets

Never put credentials in `headers` or `env` — they are visible package data, not a secret mechanism. Authorization is client-managed.

## Failure boundaries

- Invalid `mcp.json` → MCP disabled, other components still load
- Invalid server entry → that server skipped, others load
- Unsupported transport → server skipped
- Server fails to start/connect → server skipped, report the failure

## Example

```json
{
  "$schema": "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json",
  "mcpServers": {
    "local-validator": {
      "type": "stdio",
      "command": "./bin/validator",
      "args": ["--data", "${PLUGIN_DATA}/validator"],
      "env": { "CONFIG": "${PLUGIN_ROOT}/config.json" },
      "cwd": "${PLUGIN_ROOT}"
    },
    "deployment-api": {
      "type": "streamable-http",
      "url": "https://deploy.example.com/mcp"
    }
  }
}
```
