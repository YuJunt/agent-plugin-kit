#!/usr/bin/env node
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { validate } = require('./validate')
const { extractTar, collectFiles } = require('./pack')

const KNOWN_TARGETS = {
  claude: () => path.join(os.homedir(), '.claude', 'plugins'),
  cursor: () => path.join(os.homedir(), '.cursor', 'plugins'),
}

function parseArgs(argv) {
  const args = { source: null, target: null, force: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '-t' || arg === '--target') {
      i += 1
      args.target = argv[i]
    } else if (arg.startsWith('--target=')) {
      args.target = arg.slice('--target='.length)
    } else if (arg === '--force') {
      args.force = true
    } else if (arg === '-h' || arg === '--help') {
      args.help = true
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`)
      args.help = true
    } else if (args.source === null) {
      args.source = arg
    }
  }
  return args
}

function helpText() {
  const known = Object.keys(KNOWN_TARGETS).join(', ')
  return `Usage: node scripts/install.js <source> --target <name-or-path> [options]

Install a plugin into an Agent Plugins compatible client directory.
The source is validated first; invalid plugins are refused.

Arguments:
  <source>            Plugin directory or .tgz archive produced by pack.js

Options:
  -t, --target <dir>  Where to install: ${known} (well-known clients) or an explicit path
      --force         Replace the plugin if it is already installed
  -h, --help          Show this help

Examples:
  node scripts/install.js ./plugins/my-plugin --target claude
  node scripts/install.js ./dist/my-plugin-0.1.0.tgz --target /opt/agent-plugins
  node scripts/install.js ./plugins/my-plugin --target claude --force`
}

function readManifest(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, 'plugin.json'), 'utf8'))
  } catch {
    return null
  }
}

function extractToDir(archive, destDir) {
  const files = extractTar(fs.readFileSync(archive))
  fs.mkdirSync(destDir, { recursive: true })
  for (const f of files) {
    // tar-slip protection: every entry must unpack inside destDir
    const dest = path.resolve(destDir, f.name)
    if (dest !== destDir && !dest.startsWith(destDir + path.sep)) {
      throw new Error(`archive entry '${f.name}' escapes the extraction directory (tar-slip)`)
    }
    fs.mkdirSync(path.dirname(dest), { recursive: true })
    fs.writeFileSync(dest, f.data)
  }
  return files.length
}

function copyPlugin(srcRoot, destRoot) {
  const files = collectFiles(srcRoot)
  for (const f of files) {
    const target = path.join(destRoot, f.rel)
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(f.abs, target)
  }
  return files.length
}

function install(source, targetName, opts) {
  const options = opts || {}
  if (typeof targetName !== 'string' || targetName === '') {
    return { installed: false, errors: [{ field: 'target', message: 'a target is required: --target <name-or-path>' }] }
  }

  const absSource = path.resolve(source)
  if (!fs.existsSync(absSource)) {
    return { installed: false, errors: [{ field: 'source', message: `source not found: ${absSource}` }] }
  }

  const isArchive = absSource.endsWith('.tgz') && fs.statSync(absSource).isFile()
  const isDir = !isArchive && fs.statSync(absSource).isDirectory()
  if (!isArchive && !isDir) {
    return { installed: false, errors: [{ field: 'source', message: 'source must be a plugin directory or a .tgz archive' }] }
  }

  let staging = null
  try {
    if (isArchive) {
      staging = fs.mkdtempSync(path.join(os.tmpdir(), 'apk-install-'))
      try {
        extractToDir(absSource, staging)
      } catch (e) {
        return { installed: false, errors: [{ field: 'source', message: e.message }] }
      }
    }
    const srcRoot = staging || absSource

    const report = validate(srcRoot)
    if (!report.valid) {
      return {
        installed: false,
        errors: [{ field: 'source', message: `plugin is not valid; run validate first (${report.summary.errors} errors)` }],
      }
    }

    const manifest = readManifest(srcRoot)
    const name = manifest && manifest.name ? manifest.name : path.basename(srcRoot)
    const version = manifest && manifest.version ? manifest.version : '0.1.0'

    const resolver = KNOWN_TARGETS[targetName]
    const targetDir = resolver ? resolver() : path.resolve(targetName)
    const destination = path.join(targetDir, name)

    if (fs.existsSync(destination) && !options.force) {
      return {
        installed: false,
        errors: [{ field: 'destination', message: `already installed at ${destination}; use --force to replace it` }],
      }
    }

    fs.rmSync(destination, { recursive: true, force: true })
    const fileCount = copyPlugin(srcRoot, destination)

    return {
      installed: true,
      plugin: name,
      version,
      source: absSource,
      target: targetDir,
      destination,
      files: fileCount,
    }
  } finally {
    if (staging) fs.rmSync(staging, { recursive: true, force: true })
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(helpText())
    process.exit(0)
  }
  if (!args.source) {
    console.error(helpText())
    process.exit(1)
  }
  const result = install(args.source, args.target, { force: args.force })
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.installed ? 0 : 1)
}

module.exports = { install }

if (require.main === module) {
  main()
}
