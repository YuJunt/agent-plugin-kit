#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const { parseFrontmatter, collectBodyRefs } = require('./lib/skill-frontmatter')

const THIN_BODY_CHARS = 200
const ASSET_DIRS = ['scripts', 'references', 'assets']

function parseArgs(argv) {
  const args = { root: null, json: false, help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--json') args.json = true
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

function helpText() {
  return `Usage: node scripts/lint.js <plugin-root-or-skill-dir> [--json]

Lint SKILL.md content quality with objective metrics (advisory, separate
from spec validation). Checks per skill: body substance, section
headings, actionable content (lists/code blocks), title heading match,
and bundled files that are never referenced.

Options:
      --json  Print the full JSON report
  -h, --help  Show this help

Exit code: 0 when clean, 1 when findings exist.`
}

function isDir(p) {
  try {
    return fs.statSync(p).isDirectory()
  } catch {
    return false
  }
}

function isFile(p) {
  try {
    return fs.statSync(p).isFile()
  } catch {
    return false
  }
}

function listFilesRecursive(dir, prefix) {
  const files = []
  let entries = []
  try {
    entries = fs.readdirSync(dir)
  } catch {
    return files
  }
  for (const entry of entries) {
    const abs = path.join(dir, entry)
    const rel = prefix ? `${prefix}/${entry}` : entry
    if (isDir(abs)) files.push(...listFilesRecursive(abs, rel))
    else if (isFile(abs)) files.push(rel)
  }
  return files
}

function lintSkill(skillDir, dirName) {
  const findings = []
  const content = fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf8')
  const parsed = parseFrontmatter(content)
  if (!parsed.ok) {
    findings.push({ field: 'frontmatter', message: parsed.error })
    return findings
  }

  const body = parsed.body || ''
  const trimmed = body.trim()

  if (trimmed.length < THIN_BODY_CHARS) {
    findings.push({
      field: 'body',
      message: `body is thin (${trimmed.length} chars < ${THIN_BODY_CHARS}); expand the instructions so an agent can act on them`,
    })
  }

  const sectionCount = (trimmed.match(/^##\s+\S/gm) || []).length
  if (sectionCount === 0) {
    findings.push({ field: 'body', message: 'no ## section headings; structure the body with sections (e.g. When to use, Instructions)' })
  }

  const hasList = /^\s*(?:[-*]|\d+\.)\s+\S/m.test(trimmed)
  const hasCode = trimmed.includes('```')
  if (!hasList && !hasCode) {
    findings.push({ field: 'body', message: 'no lists or code blocks; add concrete steps, options, or examples' })
  }

  const title = /^#\s+(.+?)\s*$/m.exec(trimmed)
  if (!title) {
    findings.push({ field: 'title', message: 'no # title heading in the body' })
  }

  const refs = collectBodyRefs(body)
  for (const assetDir of ASSET_DIRS) {
    const bundled = listFilesRecursive(path.join(skillDir, assetDir), assetDir)
    for (const file of bundled) {
      if (!refs.has(file)) {
        findings.push({ field: 'assets', message: `bundled file '${file}' is never referenced in the body; reference it or remove it` })
      }
    }
  }

  return findings
}

function lint(root) {
  const report = { root: path.resolve(root), linted: 0, clean: true, findings: [] }

  const skillDirs = []
  if (isFile(path.join(root, 'plugin.json'))) {
    const skillsRoot = path.join(root, 'skills')
    if (isDir(skillsRoot)) {
      for (const entry of fs.readdirSync(skillsRoot)) {
        if (isDir(path.join(skillsRoot, entry)) && isFile(path.join(skillsRoot, entry, 'SKILL.md'))) {
          skillDirs.push({ dir: path.join(skillsRoot, entry), name: entry })
        }
      }
    }
  } else if (isFile(path.join(root, 'SKILL.md'))) {
    skillDirs.push({ dir: root, name: path.basename(root) })
  } else {
    report.error = 'not a plugin root (no plugin.json) and not a skill directory (no SKILL.md)'
    report.clean = false
    return report
  }

  for (const { dir, name } of skillDirs) {
    report.linted += 1
    for (const f of lintSkill(dir, name)) {
      report.findings.push({ skill: name, field: f.field, message: f.message })
    }
  }
  report.clean = report.findings.length === 0
  return report
}

function printHuman(report) {
  console.log(`${report.clean ? 'CLEAN' : 'FINDINGS'} ${report.root} (${report.linted} skill${report.linted === 1 ? '' : 's'})`)
  for (const f of report.findings) {
    console.log(`  [${f.skill}:${f.field}] ${f.message}`)
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(helpText())
    process.exit(0)
  }
  if (!args.root) {
    console.error(helpText())
    process.exit(1)
  }
  if (!fs.existsSync(args.root)) {
    console.error(`Path not found: ${args.root}`)
    process.exit(1)
  }

  const report = lint(args.root)
  if (args.json) {
    console.log(JSON.stringify(report, null, 2))
  } else {
    printHuman(report)
  }
  process.exit(report.clean ? 0 : 1)
}

module.exports = { lint }

if (require.main === module) {
  main()
}
