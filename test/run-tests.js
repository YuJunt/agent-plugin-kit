#!/usr/bin/env node
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const { spawnSync } = require('child_process')

const ROOT = path.join(__dirname, '..')
const SCRIPTS = path.join(ROOT, 'scripts')
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'apk-test-'))

let pass = 0
let fail = 0

function run(script, args, cwd) {
  return spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], {
    cwd: cwd || ROOT,
    encoding: 'utf8',
  })
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

function jsonExit(result) {
  let data = null
  try {
    data = JSON.parse(result.stdout)
  } catch {
    /* ignore */
  }
  return { status: result.status, data, stderr: result.stderr }
}

console.log('Agent Plugin Kit test suite')

console.log('create.js')
const createDir = path.join(TMP, 'created')
fs.mkdirSync(createDir, { recursive: true })
const createRes = jsonExit(run('create.js', ['my-plugin', '--full', '--skill', 'alpha', '--skill', 'beta', '-d', createDir]))
assert('create full plugin exits 0', createRes.status === 0, createRes.stderr)
assert('create reports created', createRes.data && createRes.data.created === true)
const createdRoot = path.join(createDir, 'my-plugin')
assert('plugin.json exists', fs.existsSync(path.join(createdRoot, 'plugin.json')))
assert('two skills generated', fs.existsSync(path.join(createdRoot, 'skills/alpha/SKILL.md')) && fs.existsSync(path.join(createdRoot, 'skills/beta/SKILL.md')))
assert('server.js stub generated', fs.existsSync(path.join(createdRoot, 'server.js')))
assert('LICENSE and CHANGELOG generated', fs.existsSync(path.join(createdRoot, 'LICENSE')) && fs.existsSync(path.join(createdRoot, 'CHANGELOG.md')))

const badName = jsonExit(run('create.js', ['Bad-Name', '-d', createDir]))
assert('invalid name rejected', badName.status === 1 && badName.data && badName.data.created === false)

const dupCreate = jsonExit(run('create.js', ['my-plugin', '--minimal', '-d', createDir]))
assert('duplicate dir rejected', dupCreate.status === 1)

console.log('validate.js')
const validRes = jsonExit(run('validate.js', [createdRoot, '--json']))
assert('scaffolded plugin is valid', validRes.status === 0 && validRes.data && validRes.data.valid === true, validRes.stderr)

const missingServerRoot = path.join(TMP, 'no-server')
fs.mkdirSync(missingServerRoot, { recursive: true })
fs.writeFileSync(path.join(missingServerRoot, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'no-server' }))
fs.writeFileSync(path.join(missingServerRoot, 'mcp.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', mcpServers: { s: { type: 'stdio', command: './nope.js' } } }))
const missingRes = jsonExit(run('validate.js', [missingServerRoot, '--json']))
assert('missing command file reported', missingRes.status === 1 && missingRes.data.mcp.servers[0].errors.some((e) => e.message.includes('does not exist')))

const badManifestRoot = path.join(TMP, 'bad-manifest')
fs.mkdirSync(badManifestRoot, { recursive: true })
fs.writeFileSync(path.join(badManifestRoot, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'Has--Dots' }))
const badManifestRes = jsonExit(run('validate.js', [badManifestRoot, '--json']))
assert('bad plugin name reported', badManifestRes.status === 1 && badManifestRes.data.manifest.errors.length > 0)

const badMcpRoot = path.join(TMP, 'bad-mcp')
fs.mkdirSync(path.join(badMcpRoot, 'skills'), { recursive: true })
fs.writeFileSync(path.join(badMcpRoot, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'bad-mcp' }))
fs.writeFileSync(path.join(badMcpRoot, 'mcp.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', mcpServers: { s: { type: 'stdio', command: 'npx -y foo' } } }))
const badMcpRes = jsonExit(run('validate.js', [badMcpRoot, '--json']))
assert('multi-token command reported', badMcpRes.status === 1 && badMcpRes.data.mcp.errors.length > 0)

const badRefRoot = path.join(TMP, 'bad-ref')
fs.mkdirSync(path.join(badRefRoot, 'skills/demo'), { recursive: true })
fs.writeFileSync(path.join(badRefRoot, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'bad-ref' }))
fs.writeFileSync(
  path.join(badRefRoot, 'skills/demo/SKILL.md'),
  '---\nname: demo\ndescription: A demo skill with a missing reference that should be flagged as a warning.\n---\n\nSee [missing](references/ghost.md).\n'
)
const badRefRes = jsonExit(run('validate.js', [badRefRoot, '--json']))
assert('missing skill reference warns', badRefRes.status === 0 && badRefRes.data.skills[0].warnings.some((w) => w.message.includes('does not exist')))

const versionMismatchRoot = path.join(TMP, 'version-mismatch')
fs.mkdirSync(versionMismatchRoot, { recursive: true })
fs.writeFileSync(path.join(versionMismatchRoot, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'version-mismatch' }))
fs.writeFileSync(
  path.join(versionMismatchRoot, 'mcp.json'),
  JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/0.9.0/mcp.schema.json', mcpServers: {} })
)
const versionRes = jsonExit(run('validate.js', [versionMismatchRoot, '--json']))
assert('version mismatch reported', versionRes.status === 1 && versionRes.data.mcp.errors.some((e) => e.message.includes('targets Agent Plugins 0.9.0')))

console.log('pack.js')
const packDir = path.join(TMP, 'dist')
const packRes = jsonExit(run('pack.js', [createdRoot, '-o', packDir]))
assert('pack exits 0', packRes.status === 0 && packRes.data && packRes.data.packed === true)
const archive = path.join(packDir, 'my-plugin-0.1.0.tgz')
assert('archive created', fs.existsSync(archive))

const dryRes = jsonExit(run('pack.js', [createdRoot, '--dry-run']))
assert('dry-run lists files without archive', dryRes.status === 0 && dryRes.data && dryRes.data.dryRun === true && Array.isArray(dryRes.data.files) && dryRes.data.files.includes('plugin.json'))

const verifyPackDir = path.join(TMP, 'dist-verify')
const verifyRes = jsonExit(run('pack.js', [createdRoot, '--verify', '-o', verifyPackDir]))
assert('pack --verify round-trip valid', verifyRes.status === 0 && verifyRes.data.verify && verifyRes.data.verify.valid === true)

const excludeRes = jsonExit(run('pack.js', [path.join(ROOT, 'examples', 'code-review-assistant'), '--dry-run', '--exclude', 'server.js']))
assert('exclude filter removes files', excludeRes.data && excludeRes.data.files && !excludeRes.data.files.includes('server.js') && excludeRes.data.files.includes('plugin.json'))

console.log('mcp transports')
const httpRoot = path.join(TMP, 'http-plugin')
fs.mkdirSync(httpRoot, { recursive: true })
const httpCreate = jsonExit(run('create.js', ['http-plugin', '--mcp', '--mcp-type', 'streamable-http', '--mcp-url', 'https://example.com/mcp', '-d', path.join(TMP, 'http-parent')]))
const httpCreatedRoot = path.join(TMP, 'http-parent', 'http-plugin')
assert('create streamable-http plugin', httpCreate.status === 0 && fs.existsSync(path.join(httpCreatedRoot, 'mcp.json')) && !fs.existsSync(path.join(httpCreatedRoot, 'server.js')))
const httpValid = jsonExit(run('validate.js', [httpCreatedRoot, '--json']))
assert('streamable-http plugin is valid', httpValid.status === 0 && httpValid.data && httpValid.data.valid === true, httpValid.stderr)

const badType = jsonExit(run('create.js', ['x', '--mcp', '--mcp-type', 'bogus', '-d', path.join(TMP, 'http-parent')]))
assert('invalid mcp type rejected', badType.status === 1 && badType.data && badType.data.created === false)

const placeholderRoot = path.join(TMP, 'ph-plugin')
fs.mkdirSync(placeholderRoot, { recursive: true })
fs.writeFileSync(path.join(placeholderRoot, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'ph-plugin' }))
fs.writeFileSync(
  path.join(placeholderRoot, 'mcp.json'),
  JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', mcpServers: { s: { type: 'sse', url: 'http://${FOO}/sse' } } })
)
const phRes = jsonExit(run('validate.js', [placeholderRoot, '--json']))
assert('unknown placeholder in url reported', phRes.status === 1 && phRes.data.mcp.errors.some((e) => e.message.includes('unknown placeholder')))

const phOkRoot = path.join(TMP, 'ph-ok-plugin')
fs.mkdirSync(phOkRoot, { recursive: true })
fs.writeFileSync(path.join(phOkRoot, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'ph-ok-plugin' }))
fs.writeFileSync(
  path.join(phOkRoot, 'mcp.json'),
  JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/mcp.schema.json', mcpServers: { s: { type: 'sse', url: 'https://${PLUGIN_ROOT}/sse' } } })
)
const phOkRes = jsonExit(run('validate.js', [phOkRoot, '--json']))
assert('valid placeholder in url accepted', phOkRes.status === 0 && phOkRes.data && phOkRes.data.valid === true, phOkRes.stderr)

console.log('frontmatter')
const fmRoot = path.join(TMP, 'fm-plugin')
fs.mkdirSync(path.join(fmRoot, 'skills/demo'), { recursive: true })
fs.writeFileSync(path.join(fmRoot, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'fm-plugin' }))
fs.writeFileSync(
  path.join(fmRoot, 'skills/demo/SKILL.md'),
  '---\nname: demo\ndescription: A skill exercising frontmatter validation rules end to end.\nallowed-tools: Read Write\nunknown-key: ignored\n---\n\nBody text.\n'
)
const fmRes = jsonExit(run('validate.js', [fmRoot, '--json']))
assert('allowed-tools accepted', fmRes.status === 0 && fmRes.data && fmRes.data.valid === true, fmRes.stderr)
assert('unknown frontmatter field warns', fmRes.data.skills[0].warnings.some((w) => w.message.includes("unknown frontmatter field 'unknown-key'")))

const fmBadToolsRoot = path.join(TMP, 'fm-badtools')
fs.mkdirSync(path.join(fmBadToolsRoot, 'skills/demo'), { recursive: true })
fs.writeFileSync(path.join(fmBadToolsRoot, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'fm-badtools' }))
fs.writeFileSync(
  path.join(fmBadToolsRoot, 'skills/demo/SKILL.md'),
  '---\nname: demo\ndescription: A skill with an invalid allowed-tools value for testing purposes.\nallowed-tools: "_bad tool/name"\n---\n\nBody.\n'
)
const fmBadToolsRes = jsonExit(run('validate.js', [fmBadToolsRoot, '--json']))
assert('invalid allowed-tools reported', fmBadToolsRes.status === 1 && fmBadToolsRes.data.skills[0].errors.some((e) => e.message.includes('invalid tool name')))

console.log('validate examples')
for (const ex of ['hello-plugin', 'code-review-assistant', 'git-release-notes']) {
  const res = jsonExit(run('validate.js', [path.join(ROOT, 'examples', ex), '--json']))
  assert(`examples/${ex} is valid`, res.status === 0 && res.data && res.data.valid === true, res.stderr)
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
