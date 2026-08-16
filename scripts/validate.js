#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { validate: validateSchema } = require('./lib/schema')
const { validateManifestObject, validateMcpObject, PLUGIN_SCHEMA_ID } = require('./lib/plugin-constraints')
const { validateSkill } = require('./lib/skill-frontmatter')
const { checkPackagePath } = require('./lib/path-safety')

const SCHEMAS_DIR = path.join(__dirname, '..', 'schemas')
const pluginSchema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, 'plugin.schema.json'), 'utf8'))
const mcpSchema = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, 'mcp.schema.json'), 'utf8'))

function parseArgs(argv) {
  const args = { root: null, json: false, strict: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--json') args.json = true
    else if (arg === '--strict') args.strict = true
    else if (arg === '-h' || arg === '--help') args.help = true
    else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`)
      args.help = true
    } else if (args.root === null) {
      args.root = arg
    }
  }
  return args
}

function readJson(filePath) {
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(filePath, 'utf8')) }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function summarizeIssues(errors, warnings) {
  return { errors: errors.length, warnings: warnings.length }
}

function validateManifest(root) {
  const report = { valid: false, errors: [], warnings: [] }
  const manifestPath = path.join(root, 'plugin.json')

  if (!isFile(manifestPath)) {
    report.errors.push({ field: 'manifest', message: 'missing required plugin.json at the plugin root' })
    return report
  }

  const parsed = readJson(manifestPath)
  if (!parsed.ok) {
    report.errors.push({ field: 'manifest', message: `plugin.json is not valid JSON: ${parsed.error}` })
    return report
  }

  if (parsed.data === null || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
    report.errors.push({ field: 'manifest', message: 'plugin.json must contain a top-level JSON object' })
    return report
  }

  const schemaErrors = validateSchema(parsed.data, pluginSchema, pluginSchema)
  for (const e of schemaErrors) {
    if (
      e.message.startsWith('Additional property') ||
      e.message.includes('does not match pattern') ||
      e.message.includes('one of')
    ) {
      // constraint layer reports precise violations (unknown fields, naming rules)
      continue
    }
    report.errors.push({ field: e.path || 'manifest', message: e.message })
  }

  const constraintErrors = validateManifestObject(parsed.data)
  for (const c of constraintErrors) {
    if (c.level === 'warning') report.warnings.push({ field: c.field, message: c.message })
    else report.errors.push({ field: c.field, message: c.message })
  }

  report.valid = report.errors.length === 0
  return report
}

function validateSkills(root) {
  const report = { valid: true, skills: [], warnings: [] }
  const skillsDir = path.join(root, 'skills')

  if (!fs.existsSync(skillsDir)) {
    return report
  }
  if (!isDir(skillsDir)) {
    report.valid = false
    report.warnings.push({ message: 'skills path exists but is not a directory' })
    return report
  }

  let found = 0
  for (const entry of fs.readdirSync(skillsDir)) {
    const skillDir = path.join(skillsDir, entry)
    if (!isDir(skillDir)) continue
    const skillMd = path.join(skillDir, 'SKILL.md')
    if (!isFile(skillMd)) continue
    found += 1

    let content
    try {
      content = fs.readFileSync(skillMd, 'utf8')
    } catch (e) {
      report.skills.push({ name: entry, valid: false, errors: [{ message: `unable to read SKILL.md: ${e.message}` }], warnings: [] })
      continue
    }

    const result = validateSkill(skillMd, content, entry)
    report.skills.push({ name: entry, valid: result.valid, errors: result.errors, warnings: result.warnings })
  }

  if (found === 0) {
    report.warnings.push({ message: 'skills/ directory contains no skill (no subdirectory with SKILL.md)' })
  }

  return report
}

function validateMcp(root, manifestSchema) {
  const report = { present: false, valid: false, errors: [], warnings: [], servers: [] }
  const mcpPath = path.join(root, 'mcp.json')

  if (!fs.existsSync(mcpPath)) {
    report.present = false
    return report
  }
  report.present = true

  if (!isFile(mcpPath)) {
    report.errors.push({ field: 'mcp', message: 'mcp.json is not a regular file' })
    return report
  }

  const parsed = readJson(mcpPath)
  if (!parsed.ok) {
    report.errors.push({ field: 'mcp', message: `mcp.json is not valid JSON: ${parsed.error}` })
    return report
  }

  if (parsed.data === null || typeof parsed.data !== 'object' || Array.isArray(parsed.data)) {
    report.errors.push({ field: 'mcp', message: 'mcp.json must contain a JSON object' })
    return report
  }

  const schemaErrors = validateSchema(parsed.data, mcpSchema, mcpSchema)
  for (const e of schemaErrors) {
    if (e.message.includes('does not match pattern') || e.message.includes('one of') || e.message.startsWith('Additional property')) {
      // constraint layer reports precise per-field violations
      continue
    }
    report.errors.push({ field: e.path || 'mcp', message: e.message })
  }

  const constraintErrors = validateMcpObject(parsed.data)
  for (const c of constraintErrors) {
    report.errors.push({ field: c.field, message: c.message })
  }

  if (manifestSchema && parsed.data.$schema) {
    const versionOf = (url) => {
      const m = /\/schemas\/([^/]+)\//.exec(url || '')
      return m ? m[1] : null
    }
    const manifestVersion = versionOf(manifestSchema)
    const mcpVersion = versionOf(parsed.data.$schema)
    if (manifestVersion !== null && mcpVersion !== null && manifestVersion !== mcpVersion) {
      report.errors.push({ field: 'mcp.$schema', message: `mcp.json targets Agent Plugins ${mcpVersion}, but plugin.json targets ${manifestVersion}` })
    }
  }

  if (parsed.data.mcpServers && typeof parsed.data.mcpServers === 'object') {
    for (const [name, server] of Object.entries(parsed.data.mcpServers)) {
      const serverReport = { name, valid: true, errors: [], warnings: [] }
      if (!server || typeof server !== 'object' || Array.isArray(server)) {
        serverReport.valid = false
        serverReport.errors.push({ message: 'server entry must be an object' })
      } else if (server.type === 'stdio' && typeof server.command === 'string' && server.command.startsWith('./')) {
        const resolved = path.resolve(root, server.command)
        if (!isFile(resolved)) {
          serverReport.errors.push({ message: `command '${server.command}' does not exist in the plugin` })
        }
      }
      report.servers.push(serverReport)
    }
  }

  report.valid = report.errors.length === 0 && report.servers.every((s) => s.valid)
  return report
}

function validatePathSafety(root) {
  const report = { valid: true, issues: [] }
  const candidates = []

  const mcpJson = path.join(root, 'mcp.json')
  if (isFile(mcpJson)) {
    const parsed = readJson(mcpJson)
    if (parsed.ok && parsed.data && parsed.data.mcpServers && typeof parsed.data.mcpServers === 'object') {
      for (const [name, server] of Object.entries(parsed.data.mcpServers)) {
        if (server && typeof server === 'object') {
          if (typeof server.command === 'string' && server.command.startsWith('./')) {
            candidates.push({ server: name, field: 'command', path: server.command })
          }
          if (typeof server.cwd === 'string') {
            candidates.push({ server: name, field: 'cwd', path: server.cwd })
          }
        }
      }
    }
  }

  for (const c of candidates) {
    const issues = checkPackagePath(root, c.path)
    for (const i of issues) {
      report.issues.push({ server: c.server, field: c.field, path: c.path, message: i.message })
    }
  }

  report.valid = report.issues.length === 0
  return report
}

function validate(root) {
  const report = {
    valid: false,
    root: path.resolve(root),
    summary: { errors: 0, warnings: 0 },
    manifest: validateManifest(root),
  }

  const skills = validateSkills(root)
  report.skills = skills.skills
  report.skillsWarnings = skills.warnings

  const mcp = validateMcp(root, report.manifest.valid ? readJson(path.join(root, 'plugin.json')).data?.$schema : null)
  report.mcp = {
    present: mcp.present,
    valid: mcp.valid,
    errors: mcp.errors,
    warnings: mcp.warnings,
    servers: mcp.servers,
  }

  const pathSafety = validatePathSafety(root)
  report.pathSafety = { valid: pathSafety.valid, issues: pathSafety.issues }

  for (const issue of report.pathSafety.issues) {
    const server = report.mcp.servers.find((s) => s.name === issue.server)
    if (server) {
      server.valid = false
      server.errors.push({ message: `${issue.field}: ${issue.message}` })
    }
  }

  report.mcp.valid = report.mcp.errors.length === 0 && report.mcp.servers.every((s) => s.valid)

  report.summary.errors =
    report.manifest.errors.length +
    report.skills.reduce((a, s) => a + s.errors.length, 0) +
    report.mcp.errors.length +
    report.mcp.servers.reduce((a, s) => a + s.errors.length, 0)
  report.summary.warnings =
    report.manifest.warnings.length +
    report.skills.reduce((a, s) => a + s.warnings.length, 0) +
    (report.skillsWarnings ? report.skillsWarnings.length : 0) +
    report.mcp.warnings.length +
    report.mcp.servers.reduce((a, s) => a + s.warnings.length, 0)

  report.valid = report.summary.errors === 0
  return report
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(
      `Usage: node scripts/validate.js <plugin-root> [--json] [--strict]

Validate a plugin directory against the Agent Plugins 1.0.0 specification.

Options:
  --json      Print the full JSON report
  --strict    Treat warnings as failures
  -h, --help  Show this help`
    )
    process.exit(0)
  }
  if (!args.root) {
    console.error('Usage: node scripts/validate.js <plugin-root> [--json] [--strict]')
    process.exit(1)
  }
  if (!fs.existsSync(args.root)) {
    console.error(`Plugin root not found: ${args.root}`)
    process.exit(1)
  }

  const report = validate(args.root)
  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    const status = report.valid ? 'VALID' : 'INVALID'
    console.log(`${status} ${path.resolve(args.root)}`)
    console.log(`  errors: ${report.summary.errors}, warnings: ${report.summary.warnings}`)
    for (const e of report.manifest.errors) console.log(`  [manifest] ${e.field || ''} ${e.message}`)
    for (const e of report.manifest.warnings) console.log(`  [manifest!] ${e.field || ''} ${e.message}`)
    for (const s of report.skills) {
      for (const e of s.errors) console.log(`  [skill:${s.name}] ${e.message}`)
      for (const e of s.warnings) console.log(`  [skill:${s.name}!] ${e.message}`)
    }
    if (report.skillsWarnings) {
      for (const e of report.skillsWarnings) console.log(`  [skills!] ${e.message}`)
    }
    for (const e of report.mcp.errors) console.log(`  [mcp] ${e.field || ''} ${e.message}`)
    for (const s of report.mcp.servers) {
      for (const e of s.errors) console.log(`  [mcp-server:${s.name}] ${e.message}`)
    }
  }
  process.exit(report.valid || (args.strict && report.summary.warnings > 0) ? 0 : 1)
}

module.exports = { validate }

if (require.main === module) {
  main()
}
