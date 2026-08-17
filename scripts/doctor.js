#!/usr/bin/env node
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { validate } = require('./validate')

const MIN_NODE_MAJOR = 18

const KNOWN_TARGETS = {
  claude: () => path.join(os.homedir(), '.claude', 'plugins'),
  cursor: () => path.join(os.homedir(), '.cursor', 'plugins'),
}

function parseArgs(argv) {
  const args = { target: null, json: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '-t' || arg === '--target') {
      i += 1
      args.target = argv[i]
    } else if (arg.startsWith('--target=')) {
      args.target = arg.slice('--target='.length)
    } else if (arg === '--json') {
      args.json = true
    } else if (arg === '-h' || arg === '--help') {
      args.help = true
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`)
      args.help = true
    }
  }
  return args
}

function helpText() {
  const known = Object.keys(KNOWN_TARGETS).join(', ')
  return `Usage: node scripts/doctor.js [options]

Diagnose the local Agent Plugins environment: Node.js version, known
client plugin directories, and health of every installed plugin.

Options:
  -t, --target <dir>  Also scan an explicit plugin directory (${known} are always scanned)
      --json          Print the full JSON report
  -h, --help          Show this help`
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function readManifestField(root, field) {
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'))
    return manifest[field]
  } catch {
    return undefined
  }
}

function scanTarget(name, dir) {
  const report = { name, path: dir, present: isDir(dir), plugins: [] }
  if (!report.present) return report

  let entries = []
  try {
    entries = fs.readdirSync(dir)
  } catch (e) {
    report.error = `unable to read directory: ${e.message}`
    return report
  }

  for (const entry of entries) {
    const pluginRoot = path.join(dir, entry)
    if (!isDir(pluginRoot)) continue
    if (!fs.existsSync(path.join(pluginRoot, 'plugin.json'))) continue

    const validation = validate(pluginRoot)
    report.plugins.push({
      name: readManifestField(pluginRoot, 'name') || entry,
      version: readManifestField(pluginRoot, 'version') || null,
      valid: validation.valid,
      errors: validation.summary.errors,
      warnings: validation.summary.warnings,
    })
  }
  return report
}

function doctor(extraTarget) {
  const nodeMajor = Number(process.versions.node.split('.')[0])
  const report = {
    node: { version: process.versions.node, ok: nodeMajor >= MIN_NODE_MAJOR },
    targets: [],
  }

  const targets = Object.entries(KNOWN_TARGETS).map(([name, resolve]) => [name, resolve()])
  if (extraTarget) {
    const resolver = KNOWN_TARGETS[extraTarget]
    // Skip duplicates: an explicit well-known name is already scanned by default
    if (!resolver) targets.push([extraTarget, path.resolve(extraTarget)])
  }

  for (const [name, dir] of targets) {
    report.targets.push(scanTarget(name, dir))
  }

  const installedPlugins = report.targets.reduce((sum, t) => sum + t.plugins.length, 0)
  report.summary = {
    ok: report.node.ok && report.targets.every((t) => t.plugins.every((p) => p.valid)),
    installedPlugins,
    invalidPlugins: report.targets.reduce((sum, t) => sum + t.plugins.filter((p) => !p.valid).length, 0),
  }
  return report
}

function printHuman(report) {
  console.log(`node ${report.node.version} ${report.node.ok ? 'OK' : `UNSUPPORTED (requires >= ${MIN_NODE_MAJOR})`}`)
  for (const t of report.targets) {
    if (!t.present) {
      console.log(`  ${t.name}: not found (${t.path})`)
      continue
    }
    console.log(`  ${t.name}: ${t.path}`)
    if (t.error) {
      console.log(`    error: ${t.error}`)
      continue
    }
    if (t.plugins.length === 0) {
      console.log('    no plugins installed')
      continue
    }
    for (const p of t.plugins) {
      const status = p.valid ? 'valid' : `INVALID (${p.errors} errors, ${p.warnings} warnings)`
      console.log(`    ${p.name}@${p.version || '?'} — ${status}`)
    }
  }
  console.log(report.summary.ok ? 'environment OK' : `problems found (${report.summary.invalidPlugins} invalid plugins)`)
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(helpText())
    process.exit(0)
  }
  const report = doctor(args.target)
  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printHuman(report)
  }
  process.exit(report.summary.ok ? 0 : 1)
}

module.exports = { doctor }

if (require.main === module) {
  main()
}
