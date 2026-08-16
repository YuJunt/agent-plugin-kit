#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { validatePluginName } = require('./lib/plugin-constraints')

const TEMPLATES_DIR = path.join(__dirname, '..', 'assets', 'templates')

function parseArgs(argv) {
  const args = {
    name: null,
    skills: false,
    mcp: false,
    full: false,
    minimal: false,
    dir: process.cwd(),
    noInput: false,
    help: false,
  }
  const positional = []
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    switch (arg) {
      case '-s':
      case '--skills':
        args.skills = true
        break
      case '-m':
      case '--mcp':
        args.mcp = true
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
      case '--no-input':
        args.noInput = true
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
  -m, --mcp           Include mcp.json template
      --full          Complete skeleton (full manifest + skills + mcp + LICENSE)
      --minimal       Minimal skeleton (manifest + skills placeholder)
  -d, --dir <path>    Output directory (default: current directory)
      --no-input      Non-interactive mode
  -h, --help          Show this help

Examples:
  node scripts/create.js my-plugin --full -d ./plugins
  node scripts/create.js my-plugin --skills --mcp`
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

function createSkeleton(args) {
  const errors = validatePluginName(args.name)
  if (errors.length > 0) {
    return { created: false, errors: errors.map((e) => ({ field: 'name', message: e })) }
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
  const vars = { PLUGIN_NAME: args.name, SKILL_NAME: 'hello', SERVER_NAME: 'server' }

  const manifest = full
    ? render(readTemplate('plugin.json.tpl'), vars)
    : JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: args.name }, null, 2) + '\n'
  writeFile(outputRoot, 'plugin.json', manifest)
  created.push('plugin.json')

  if (includeSkills) {
    writeFile(outputRoot, 'skills/hello/SKILL.md', render(readTemplate('SKILL.md.tpl'), { ...vars, SKILL_NAME: 'hello' }))
    created.push('skills/hello/SKILL.md')
  }

  if (includeMcp) {
    writeFile(outputRoot, 'mcp.json', render(readTemplate('mcp.json.tpl'), vars))
    created.push('mcp.json')
  }

  if (full) {
    writeFile(
      outputRoot,
      'LICENSE',
      `MIT License\n\nCopyright (c) ${new Date().getFullYear()} ${args.name} authors\n\nPermission is hereby granted, free of charge, to any person obtaining a copy of this software...`
    )
    created.push('LICENSE')
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
