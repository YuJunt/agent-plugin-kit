#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { validatePluginName } = require('./lib/plugin-constraints')

const TEMPLATES_DIR = path.join(__dirname, '..', 'assets', 'templates')

function parseArgs(argv) {
  const args = {
    name: null,
    skills: [],
    skill: null,
    skillList: [],
    mcp: false,
    mcpType: 'stdio',
    mcpUrl: 'http://localhost:8080/mcp',
    full: false,
    minimal: false,
    dir: process.cwd(),
    help: false,
  }
  const positional = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    switch (arg) {
      case '-s':
      case '--skills':
        args.skills = []
        break
      case '-m':
      case '--mcp':
        args.mcp = true
        break
      case '--mcp-type':
        i += 1
        args.mcpType = argv[i]
        break
      case '--mcp-url':
        i += 1
        args.mcpUrl = argv[i]
        break
      case '--skill':
        i += 1
        args.skill = argv[i]
        if (argv[i]) args.skillList.push(argv[i])
        break
      case '--full':
        args.full = true
        break
      case '--minimal':
        args.minimal = true
        break
      case '-d':
      case '--dir':
        i += 1
        args.dir = argv[i]
        break
      case '-h':
      case '--help':
        args.help = true
        break
      default:
        if (arg.startsWith('--dir=')) {
          args.dir = arg.slice('--dir='.length)
        } else if (arg.startsWith('-d=')) {
          args.dir = arg.slice('-d='.length)
        } else if (arg.startsWith('--skill=')) {
          args.skill = arg.slice('--skill='.length)
          args.skillList.push(args.skill)
        } else if (arg.startsWith('--mcp-type=')) {
          args.mcpType = arg.slice('--mcp-type='.length)
        } else if (arg.startsWith('--mcp-url=')) {
          args.mcpUrl = arg.slice('--mcp-url='.length)
        } else if (arg.startsWith('-')) {
          console.error(`Unknown option: ${arg}`)
          args.help = true
        } else {
          positional.push(arg)
        }
    }
  }
  if (positional.length > 0) args.name = positional[0]
  return args
}

function helpText() {
  return `Usage: node scripts/create.js <plugin-name> [options]

Create an Agent Plugin skeleton conforming to Agent Plugins 1.0.0.

Options:
  -s, --skills        Include skills/ directory with a SKILL.md template
      --skill <name>  Name of the generated skill (repeatable; default: hello)
  -m, --mcp           Include mcp.json (+ server.js stub for stdio)
      --mcp-type <t>  MCP transport: stdio, streamable-http, or sse (default: stdio)
      --mcp-url <url> URL for streamable-http/sse transports (default: http://localhost:8080/mcp)
      --full          Complete skeleton (full manifest + skills + mcp + server.js + LICENSE + CHANGELOG)
      --minimal       Minimal skeleton (manifest + skills placeholder)
  -d, --dir <path>    Output directory (default: current directory)
  -h, --help          Show this help

Examples:
  node scripts/create.js my-plugin --full -d ./plugins
  node scripts/create.js my-plugin --skills --skill summarize --mcp
  node scripts/create.js my-plugin --mcp --mcp-type streamable-http --mcp-url https://example.com/mcp`
}

function render(template, vars) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, key) => (key in vars ? vars[key] : m))
}

function readTemplate(name) {
  return fs.readFileSync(path.join(TEMPLATES_DIR, name), 'utf8')
}

function writeFile(root, relPath, content) {
  const target = path.join(root, relPath)
  fs.mkdirSync(path.dirname(target), { recursive: true })
  fs.writeFileSync(target, content, 'utf8')
}

const MCP_TYPES = ['stdio', 'streamable-http', 'sse']

function createSkeleton(args) {
  const errors = validatePluginName(args.name)
  if (errors.length > 0) {
    return { created: false, errors: errors.map((e) => ({ field: 'name', message: e })) }
  }

  if (!MCP_TYPES.includes(args.mcpType)) {
    return { created: false, errors: [{ field: 'mcpType', message: `unknown mcp type '${args.mcpType}'; must be one of: ${MCP_TYPES.join(', ')}` }] }
  }

  const full = args.full
  const includeSkills = full || args.minimal || args.skills
  const includeMcp = full || args.mcp
  const outputRoot = path.resolve(args.dir, args.name)

  if (fs.existsSync(outputRoot)) {
    return { created: false, errors: [{ field: 'root', message: `Target directory already exists: ${outputRoot}` }] }
  }
  fs.mkdirSync(outputRoot, { recursive: true })

  const created = []
  const skillNames =
    Array.isArray(args.skillList) && args.skillList.length > 0 ? args.skillList : [args.skill || 'hello']
  const vars = { PLUGIN_NAME: args.name, SERVER_NAME: 'server', MCP_URL: args.mcpUrl, DATE: new Date().toISOString().slice(0, 10) }

  const manifest = full
    ? render(readTemplate('plugin.json.tpl'), vars)
    : JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: args.name }, null, 2) + '\n'
  writeFile(outputRoot, 'plugin.json', manifest)
  created.push('plugin.json')

  if (includeSkills) {
    for (const skill of skillNames) {
      writeFile(outputRoot, `skills/${skill}/SKILL.md`, render(readTemplate('SKILL.md.tpl'), { ...vars, SKILL_NAME: skill }))
      created.push(`skills/${skill}/SKILL.md`)
    }
  }

  if (includeMcp) {
    const template =
      args.mcpType === 'streamable-http'
        ? 'mcp.http.json.tpl'
        : args.mcpType === 'sse'
          ? 'mcp.sse.json.tpl'
          : 'mcp.json.tpl'
    writeFile(outputRoot, 'mcp.json', render(readTemplate(template), vars))
    created.push('mcp.json')
    if (args.mcpType === 'stdio') {
      writeFile(outputRoot, 'server.js', render(readTemplate('server.js.tpl'), vars))
      created.push('server.js')
    }
  }

  if (full) {
    writeFile(
      outputRoot,
      'LICENSE',
      render(readTemplate('LICENSE.tpl'), { ...vars, YEAR: new Date().getFullYear().toString() })
    )
    created.push('LICENSE')
    writeFile(outputRoot, 'CHANGELOG.md', render(readTemplate('CHANGELOG.md.tpl'), vars))
    created.push('CHANGELOG.md')
  }

  return { created: true, root: outputRoot, files: created }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(helpText())
    process.exit(0)
  }
  if (!args.name) {
    console.error(helpText())
    process.exit(1)
  }
  const result = createSkeleton(args)
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.created ? 0 : 1)
}

module.exports = { createSkeleton, parseArgs }

if (require.main === module) {
  main()
}
