#!/usr/bin/env node
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const SCRIPTS = path.join(ROOT, 'scripts')
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'apk-contract-'))

let pass = 0
let fail = 0

function run(script, args, cwd) {
  return spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], {
    cwd: cwd || ROOT,
    encoding: 'utf8',
  })
}

function jsonExit(result) {
  let data = null
  try {
    data = JSON.parse(result.stdout)
  } catch {
    /* ignore */
  }
  return { status: result.status, data, stderr: result.stderr }
}

function assert(name, cond, detail) {
  if (cond) {
    pass += 1
    console.log(`  ok - ${name}`)
  } else {
    fail += 1
    console.log(`  FAIL - ${name} ${detail ? `(${detail})` : ''}`)
  }
}

const createDir = path.join(TMP, 'root')
fs.mkdirSync(createDir, { recursive: true })
const c = jsonExit(run('create.js', ['contract-plugin', '--full', '-d', createDir]))
const pluginRoot = path.join(createDir, 'contract-plugin')

console.log('create output contract')
assert('create: created boolean', typeof c.data.created === 'boolean')
assert('create: root string', typeof c.data.root === 'string')
assert('create: files array of strings', Array.isArray(c.data.files) && c.data.files.every((f) => typeof f === 'string'))
assert('create: error shape when failed', (() => {
  const bad = jsonExit(run('create.js', ['Bad Name', '-d', createDir]))
  return Array.isArray(bad.data.errors) && bad.data.errors.every((e) => typeof e.field === 'string' && typeof e.message === 'string')
})(), c.stderr)

console.log('validate output contract')
const v = jsonExit(run('validate.js', [pluginRoot, '--json']))
assert('validate: valid boolean', typeof v.data.valid === 'boolean')
assert('validate: root string', typeof v.data.root === 'string')
assert('validate: summary.errors number', typeof v.data.summary.errors === 'number')
assert('validate: summary.warnings number', typeof v.data.summary.warnings === 'number')
assert('validate: manifest object', v.data.manifest && typeof v.data.manifest === 'object')
assert('validate: manifest.valid boolean', typeof v.data.manifest.valid === 'boolean')
assert('validate: skills array', Array.isArray(v.data.skills))
assert('validate: skills[].valid boolean', v.data.skills.every((s) => typeof s.valid === 'boolean'))
assert('validate: skills[].errors array', v.data.skills.every((s) => Array.isArray(s.errors)))
assert('validate: mcp object', v.data.mcp && typeof v.data.mcp === 'object')
assert('validate: mcp.valid boolean', typeof v.data.mcp.valid === 'boolean')
assert('validate: pathSafety object', v.data.pathSafety && typeof v.data.pathSafety === 'object')
assert('validate: pathSafety.valid boolean', typeof v.data.pathSafety.valid === 'boolean')

console.log('pack output contract')
const packDir = path.join(TMP, 'dist')
const p = jsonExit(run('pack.js', [pluginRoot, '-o', packDir, '--verify']))
assert('pack: packed boolean', typeof p.data.packed === 'boolean')
assert('pack: archive string', typeof p.data.archive === 'string')
assert('pack: bytes number', typeof p.data.bytes === 'number')
assert('pack: files number', typeof p.data.files === 'number')
assert('pack: checksum object', p.data.checksum && typeof p.data.checksum.value === 'string' && p.data.checksum.algorithm === 'sha256')
assert('pack: verify object', p.data.verify && typeof p.data.verify.valid === 'boolean' && typeof p.data.verify.fileCount === 'number')

console.log('dry-run contract')
const d = jsonExit(run('pack.js', [pluginRoot, '--dry-run']))
assert('dry-run: dryRun true', d.data.dryRun === true)
assert('dry-run: files array', Array.isArray(d.data.files))

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
