'use strict'

const PLUGIN_SCHEMA_ID = 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json'
const MCP_SCHEMA_ID = 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json'

const PLUGIN_NAME_RE = /^(?!.*(--|\.\.))[a-z0-9][a-z0-9.-]*[a-z0-9]$/

const SEMVER_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/

const MANIFEST_FIELDS = new Set([
  '$schema',
  'name',
  'version',
  'description',
  'author',
  'homepage',
  'repository',
  'license',
  'keywords',
  'extensions',
])

// Recognize an agent-plugins.org schema URL of any version (e.g. 1.1.0, 2.0.0)
const SCHEMA_URL_RE = /^https:\/\/agent-plugins\.org\/schemas\/([^/]+)\/(plugin|mcp)\.schema\.json$/

function schemaMismatchMessage(actual, expectedId) {
  const m = SCHEMA_URL_RE.exec(actual || '')
  if (m && m[1] !== '1.0.0') {
    return `$schema '${actual}' targets Agent Plugins ${m[1]}, which this toolkit does not support yet (supported: 1.0.0); expected ${expectedId}`
  }
  return `$schema must be ${expectedId}`
}

function validatePluginName(name) {
  if (typeof name !== 'string') return ['name must be a string']
  if (name.length < 1 || name.length > 64) return ['name must be between 1 and 64 characters']
  if (!/^[a-z0-9.-]+$/.test(name)) return ['name may only contain lowercase alphanumeric characters, hyphens, and periods']
  if (!/^[a-z0-9]/.test(name)) return ['name must start with an alphanumeric character']
  if (!/[a-z0-9]$/.test(name)) return ['name must end with an alphanumeric character']
  if (/--/.test(name)) return ['name must not contain consecutive hyphens']
  if (/\.\./.test(name)) return ['name must not contain consecutive periods']
  return []
}

function validateAuthor(author) {
  const errors = []
  if (author === null || typeof author !== 'object' || Array.isArray(author)) {
    return ['author must be an object']
  }
  const allowed = new Set(['name', 'email', 'url'])
  for (const key of Object.keys(author)) {
    if (!allowed.has(key)) {
      errors.push(`author.${key} is not a permitted field`)
    }
  }
  for (const key of allowed) {
    if (key in author && typeof author[key] !== 'string') {
      errors.push(`author.${key} must be a string`)
    }
  }
  return errors
}

function validateKeywords(keywords) {
  if (!Array.isArray(keywords)) return ['keywords must be an array']
  return keywords.filter((k) => typeof k !== 'string').map((k) => `keyword must be a string, got ${typeof k}`)
}

function validateManifestObject(manifest) {
  const errors = []

  for (const key of Object.keys(manifest)) {
    if (!MANIFEST_FIELDS.has(key)) {
      errors.push({ field: key, level: 'warning', message: `Unknown top-level field '${key}' is ignored (report and ignore)` })
    }
  }

  if (typeof manifest.$schema !== 'string' || manifest.$schema !== PLUGIN_SCHEMA_ID) {
    errors.push({ field: '$schema', level: 'error', message: schemaMismatchMessage(manifest.$schema, PLUGIN_SCHEMA_ID) })
  }

  for (const err of validatePluginName(manifest.name)) {
    errors.push({ field: 'name', level: 'error', message: err })
  }

  if (manifest.version !== undefined) {
    if (typeof manifest.version !== 'string') {
      errors.push({ field: 'version', level: 'error', message: 'version must be a string' })
    } else if (!SEMVER_RE.test(manifest.version)) {
      errors.push({
        field: 'version',
        level: 'warning',
        message: `version '${manifest.version}' is not valid Semantic Versioning (expected MAJOR.MINOR.PATCH with optional -prerelease/+build); it is used in the packaged archive name`,
      })
    }
  }
  if (manifest.description !== undefined && typeof manifest.description !== 'string') {
    errors.push({ field: 'description', level: 'error', message: 'description must be a string' })
  }
  if (manifest.author !== undefined) {
    for (const err of validateAuthor(manifest.author)) {
      errors.push({ field: 'author', level: 'error', message: err })
    }
  }
  if (manifest.homepage !== undefined && typeof manifest.homepage !== 'string') {
    errors.push({ field: 'homepage', level: 'error', message: 'homepage must be a string' })
  }
  if (manifest.repository !== undefined && typeof manifest.repository !== 'string') {
    errors.push({ field: 'repository', level: 'error', message: 'repository must be a string' })
  }
  if (manifest.license !== undefined && typeof manifest.license !== 'string') {
    errors.push({ field: 'license', level: 'error', message: 'license must be a string' })
  }
  if (manifest.keywords !== undefined) {
    for (const err of validateKeywords(manifest.keywords)) {
      errors.push({ field: 'keywords', level: 'error', message: err })
    }
  }
  if (manifest.extensions !== undefined) {
    if (manifest.extensions === null || typeof manifest.extensions !== 'object' || Array.isArray(manifest.extensions)) {
      errors.push({ field: 'extensions', level: 'warning', message: 'extensions is not an object and is ignored' })
    } else {
      for (const [ns, value] of Object.entries(manifest.extensions)) {
        if (value === null || typeof value !== 'object' || Array.isArray(value)) {
          errors.push({ field: `extensions.${ns}`, level: 'warning', message: `Extension value for '${ns}' is not an object and is ignored` })
        }
      }
    }
  }

  return errors
}

function validateMcpUrl(url) {
  if (typeof url !== 'string' || url.length === 0) return ['url must be a non-empty string']
  const placeholderRe = /\$\{[A-Z0-9_]+\}/g
  const placeholders = new Set(url.match(placeholderRe) || [])
  for (const ph of placeholders) {
    if (ph !== '${PLUGIN_ROOT}' && ph !== '${PLUGIN_DATA}') {
      return [`url contains unknown placeholder ${ph}; only \${PLUGIN_ROOT} and \${PLUGIN_DATA} are permitted`]
    }
  }
  let parsed
  try {
    parsed = new URL(url.replace(placeholderRe, 'localhost'))
  } catch {
    return ['url must be an absolute HTTP or HTTPS URL (with any ${PLUGIN_ROOT}/${PLUGIN_DATA} placeholders resolved)']
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return ['url must use http or https']
  }
  if (parsed.username || parsed.password) {
    return ['url must not contain user information']
  }
  if (parsed.hash) {
    return ['url must not contain a fragment']
  }
  const host = parsed.hostname
  const isLoopback = host === 'localhost' || /^127\./.test(host) || host === '::1' || /^\[?::1\]?$/.test(host)
  if (parsed.protocol === 'http:' && !isLoopback) {
    return ['non-loopback endpoints must use HTTPS']
  }
  return []
}

function validateHeaderNames(headers) {
  const seen = new Set()
  for (const name of Object.keys(headers)) {
    const lower = name.toLowerCase()
    if (seen.has(lower)) {
      return [`duplicate header name '${name}' under different casing`]
    }
    seen.add(lower)
  }
  return []
}

function validateCwd(cwd) {
  if (typeof cwd !== 'string') return ['cwd must be a string']
  if (cwd.startsWith('./')) return []
  if (cwd === '${PLUGIN_ROOT}' || cwd.startsWith('${PLUGIN_ROOT}/')) return []
  if (cwd === '${PLUGIN_DATA}' || cwd.startsWith('${PLUGIN_DATA}/')) return []
  return ['cwd must be a ./ plugin-relative path, or a path rooted at ${PLUGIN_ROOT} or ${PLUGIN_DATA}']
}

function validateStdioCommand(command) {
  if (typeof command !== 'string') return ['command must be a string']
  if (command.startsWith('./')) return []
  if (/^[a-zA-Z0-9._-]+$/.test(command)) return []
  return ['command must be a single executable token (bare name or ./ plugin-relative path)']
}

function validateMcpServer(name, server) {
  const errors = []
  if (server === null || typeof server !== 'object' || Array.isArray(server)) {
    return [{ field: `mcpServers.${name}`, level: 'error', message: 'server must be an object' }]
  }

  if (server.type === 'stdio') {
    for (const err of validateStdioCommand(server.command)) {
      errors.push({ field: `mcpServers.${name}.command`, level: 'error', message: err })
    }
    if (server.args !== undefined) {
      if (!Array.isArray(server.args) || server.args.some((a) => typeof a !== 'string')) {
        errors.push({ field: `mcpServers.${name}.args`, level: 'error', message: 'args must be an array of strings' })
      }
    }
    if (server.env !== undefined) {
      if (server.env === null || typeof server.env !== 'object' || Array.isArray(server.env)) {
        errors.push({ field: `mcpServers.${name}.env`, level: 'error', message: 'env must be an object of strings' })
      } else {
        for (const [k, v] of Object.entries(server.env)) {
          if (typeof v !== 'string') {
            errors.push({ field: `mcpServers.${name}.env.${k}`, level: 'error', message: 'env value must be a string' })
          }
          if (k === 'PLUGIN_ROOT' || k === 'PLUGIN_DATA') {
            errors.push({ field: `mcpServers.${name}.env.${k}`, level: 'error', message: 'env must not contain reserved PLUGIN_ROOT or PLUGIN_DATA entries' })
          }
        }
      }
    }
    if (server.cwd !== undefined) {
      for (const err of validateCwd(server.cwd)) {
        errors.push({ field: `mcpServers.${name}.cwd`, level: 'error', message: err })
      }
    }
    for (const key of Object.keys(server)) {
      if (!['type', 'command', 'args', 'env', 'cwd'].includes(key)) {
        errors.push({ field: `mcpServers.${name}.${key}`, level: 'error', message: `unknown field '${key}' for stdio variant` })
      }
    }
  } else if (server.type === 'streamable-http' || server.type === 'sse') {
    for (const err of validateMcpUrl(server.url)) {
      errors.push({ field: `mcpServers.${name}.url`, level: 'error', message: err })
    }
    if (server.headers !== undefined) {
      if (server.headers === null || typeof server.headers !== 'object' || Array.isArray(server.headers)) {
        errors.push({ field: `mcpServers.${name}.headers`, level: 'error', message: 'headers must be an object of strings' })
      } else {
        for (const [k, v] of Object.entries(server.headers)) {
          if (typeof v !== 'string') {
            errors.push({ field: `mcpServers.${name}.headers.${k}`, level: 'error', message: 'header value must be a string' })
          }
        }
        for (const err of validateHeaderNames(server.headers)) {
          errors.push({ field: `mcpServers.${name}.headers`, level: 'error', message: err })
        }
      }
    }
    for (const key of Object.keys(server)) {
      if (!['type', 'url', 'headers'].includes(key)) {
        errors.push({ field: `mcpServers.${name}.${key}`, level: 'error', message: `unknown field '${key}' for ${server.type} variant` })
      }
    }
  } else {
    errors.push({ field: `mcpServers.${name}.type`, level: 'error', message: `unknown type '${server.type}'; must be stdio, streamable-http, or sse` })
  }

  return errors
}

function validateMcpObject(mcp) {
  const errors = []
  if (mcp === null || typeof mcp !== 'object' || Array.isArray(mcp)) {
    return [{ field: 'mcp', level: 'error', message: 'mcp.json must contain a JSON object' }]
  }
  if (typeof mcp.$schema !== 'string' || mcp.$schema !== MCP_SCHEMA_ID) {
    errors.push({ field: '$schema', level: 'error', message: schemaMismatchMessage(mcp.$schema, MCP_SCHEMA_ID) })
  }
  for (const key of Object.keys(mcp)) {
    if (key !== '$schema' && key !== 'mcpServers') {
      errors.push({ field: key, level: 'error', message: `unknown top-level field '${key}' in mcp.json` })
    }
  }
  if (mcp.mcpServers === undefined) {
    errors.push({ field: 'mcpServers', level: 'error', message: 'missing required field mcpServers' })
  } else if (mcp.mcpServers === null || typeof mcp.mcpServers !== 'object' || Array.isArray(mcp.mcpServers)) {
    errors.push({ field: 'mcpServers', level: 'error', message: 'mcpServers must be an object' })
  } else {
    for (const [name, server] of Object.entries(mcp.mcpServers)) {
      errors.push(...validateMcpServer(name, server))
    }
  }
  return errors
}

module.exports = {
  PLUGIN_SCHEMA_ID,
  MCP_SCHEMA_ID,
  validatePluginName,
  validateManifestObject,
  validateMcpObject,
}
