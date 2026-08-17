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

function run(script, args, cwd, env) {
  return spawnSync(process.execPath, [path.join(SCRIPTS, script), ...args], {
    cwd: cwd || ROOT,
    encoding: 'utf8',
    env: env || process.env,
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

console.log('regression: --strict exit codes')
const strictWarnRoot = path.join(TMP, 'strict-warn')
fs.mkdirSync(strictWarnRoot, { recursive: true })
fs.writeFileSync(
  path.join(strictWarnRoot, 'plugin.json'),
  JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'strict-warn', whoops: 1 })
)
const laxRes = jsonExit(run('validate.js', [strictWarnRoot, '--json']))
assert('warnings only: non-strict exits 0', laxRes.status === 0 && laxRes.data.valid === true && laxRes.data.summary.warnings === 1)
const strictWarnRes = jsonExit(run('validate.js', [strictWarnRoot, '--json', '--strict']))
assert('warnings only: strict exits 1', strictWarnRes.status === 1, `got ${strictWarnRes.status}`)
const strictCleanRes = jsonExit(run('validate.js', [path.join(ROOT, 'examples', 'hello-plugin'), '--json', '--strict']))
assert('clean plugin: strict exits 0', strictCleanRes.status === 0, `got ${strictCleanRes.status}`)
const strictInvalidRes = jsonExit(run('validate.js', [badManifestRoot, '--json', '--strict']))
assert('invalid plugin: strict still exits 1', strictInvalidRes.status === 1)

console.log('regression: long tar paths (ustar prefix)')
const longSkill = 'a'.repeat(40)
const longFile = 'b'.repeat(50) + '.md'
const longRoot = path.join(TMP, 'long-plugin')
fs.mkdirSync(path.join(longRoot, 'skills', longSkill, 'references'), { recursive: true })
fs.writeFileSync(path.join(longRoot, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'long-plugin', version: '0.1.0' }))
fs.writeFileSync(path.join(longRoot, 'skills', longSkill, 'SKILL.md'), `---\nname: ${longSkill}\ndescription: A skill whose packaged asset path exceeds 100 chars to exercise ustar prefix handling in pack.\n---\n\nSee references/${longFile}.\n`)
fs.writeFileSync(path.join(longRoot, 'skills', longSkill, 'references', longFile), 'Reference content.\n')
const longRel = `skills/${longSkill}/references/${longFile}`
assert('fixture path exceeds 100 chars', longRel.length > 100)
const longPackRes = jsonExit(run('pack.js', [longRoot, '--verify', '-o', path.join(TMP, 'dist-long')]))
assert('long path pack + verify round-trip', longPackRes.status === 0 && longPackRes.data.verify && longPackRes.data.verify.valid === true, longPackRes.stderr)
const { extractTar } = require(path.join(SCRIPTS, 'pack.js'))
const longNames = extractTar(fs.readFileSync(path.join(TMP, 'dist-long', 'long-plugin-0.1.0.tgz'))).map((f) => f.name)
assert('long path preserved in archive entries', longNames.includes(longRel), longNames.join(','))

console.log('regression: tar-slip protection')
const zlib = require('zlib')
const { verifyArchive } = require(path.join(SCRIPTS, 'pack.js'))
const evilHeader = Buffer.alloc(512)
evilHeader.write('../evil.txt', 0, 100, 'utf8')
evilHeader.write((0o644).toString(8).padStart(7, '0'), 100, 7, 'utf8')
evilHeader.write('00000000000', 124, 11, 'utf8')
evilHeader.write('0', 156, 1, 'utf8')
const evilTgz = path.join(TMP, 'evil.tgz')
fs.writeFileSync(evilTgz, zlib.gzipSync(Buffer.concat([evilHeader, Buffer.alloc(1024)])))
let tarSlipThrown = false
try {
  verifyArchive(evilTgz)
} catch (e) {
  tarSlipThrown = e.message.includes('tar-slip')
}
assert('escaping archive entry rejected', tarSlipThrown)

console.log('regression: version semver warning')
const badVerRoot = path.join(TMP, 'bad-version')
fs.mkdirSync(badVerRoot, { recursive: true })
fs.writeFileSync(
  path.join(badVerRoot, 'plugin.json'),
  JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'bad-version', version: '1.0' })
)
const badVerRes = jsonExit(run('validate.js', [badVerRoot, '--json']))
assert(
  'non-semver version warns but stays valid',
  badVerRes.status === 0 &&
    badVerRes.data.valid === true &&
    badVerRes.data.manifest.warnings.some((w) => w.message.includes('not valid Semantic Versioning')),
  JSON.stringify(badVerRes.data && badVerRes.data.manifest)
)
const strictVerRes = jsonExit(run('validate.js', [badVerRoot, '--json', '--strict']))
assert('non-semver version fails under --strict', strictVerRes.status === 1)
const goodVerRoot = path.join(TMP, 'good-version')
fs.mkdirSync(goodVerRoot, { recursive: true })
fs.writeFileSync(
  path.join(goodVerRoot, 'plugin.json'),
  JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'good-version', version: '1.2.3-beta.1+build.5' })
)
const goodVerRes = jsonExit(run('validate.js', [goodVerRoot, '--json', '--strict']))
assert('full semver (prerelease+build) passes strict', goodVerRes.status === 0)

console.log('regression: glob ** segment semantics')
const globRoot = path.join(TMP, 'glob-plugin')
for (const p of ['docs/sub', 'skills/demo']) fs.mkdirSync(path.join(globRoot, p), { recursive: true })
fs.writeFileSync(path.join(globRoot, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'glob-plugin', version: '0.1.0' }))
fs.writeFileSync(path.join(globRoot, 'skills/demo/SKILL.md'), '---\nname: demo\ndescription: A fixture skill for testing glob include and exclude semantics in pack.\n---\n\nBody.\n')
fs.writeFileSync(path.join(globRoot, 'draft.md'), 'root draft\n')
fs.writeFileSync(path.join(globRoot, 'docs/draft.md'), 'docs draft\n')
fs.writeFileSync(path.join(globRoot, 'docs/sub/draft.md'), 'nested draft\n')
fs.writeFileSync(path.join(globRoot, 'docs/keep.md'), 'docs keep\n')
fs.writeFileSync(path.join(globRoot, 'docs/sub/keep.md'), 'nested keep\n')
const globExclude = jsonExit(run('pack.js', [globRoot, '--dry-run', '--exclude', '**/draft.md']))
assert(
  '**/x excludes root and nested matches',
  globExclude.data.files.includes('docs/keep.md') && !globExclude.data.files.includes('draft.md') && !globExclude.data.files.includes('docs/draft.md') && !globExclude.data.files.includes('docs/sub/draft.md'),
  globExclude.data.files.join(',')
)
const globInclude = jsonExit(run('pack.js', [globRoot, '--dry-run', '--include', 'docs/**/keep.md']))
assert(
  'a/**/b matches zero and multiple segments',
  globInclude.data.files.includes('docs/keep.md') && globInclude.data.files.includes('docs/sub/keep.md') && globInclude.data.files.includes('plugin.json') && !globInclude.data.files.includes('draft.md'),
  globInclude.data.files.join(',')
)

console.log('install.js')
const clientDir = path.join(TMP, 'client-plugins')
const instRes = jsonExit(run('install.js', [createdRoot, '--target', clientDir]))
assert(
  'install from directory exits 0',
  instRes.status === 0 && instRes.data && instRes.data.installed === true,
  instRes.stderr
)
const instDest = path.join(clientDir, 'my-plugin')
assert('destination named after plugin', fs.existsSync(path.join(instDest, 'plugin.json')) && fs.existsSync(path.join(instDest, 'skills/alpha/SKILL.md')))
const instValid = jsonExit(run('validate.js', [instDest, '--json']))
assert('installed plugin validates', instValid.status === 0 && instValid.data.valid === true, instValid.stderr)

const dupInst = jsonExit(run('install.js', [createdRoot, '--target', clientDir]))
assert('reinstall without --force refused', dupInst.status === 1 && dupInst.data.errors.some((e) => e.message.includes('already installed')))
const forceInst = jsonExit(run('install.js', [createdRoot, '--target', clientDir, '--force']))
assert('reinstall with --force succeeds', forceInst.status === 0 && forceInst.data.installed === true, forceInst.stderr)

const archiveSource = path.join(packDir, 'my-plugin-0.1.0.tgz')
const tgzInst = jsonExit(run('install.js', [archiveSource, '--target', path.join(TMP, 'client-tgz')]))
assert(
  'install from tgz archive',
  tgzInst.status === 0 && tgzInst.data.installed === true && fs.existsSync(path.join(TMP, 'client-tgz', 'my-plugin', 'plugin.json')),
  tgzInst.stderr
)

const noTarget = jsonExit(run('install.js', [createdRoot]))
assert('missing target rejected', noTarget.status === 1 && noTarget.data.errors.some((e) => e.field === 'target'))

const invalidInst = jsonExit(run('install.js', [badManifestRoot, '--target', path.join(TMP, 'client-bad')]))
assert('invalid plugin refused', invalidInst.status === 1 && invalidInst.data.errors.some((e) => e.message.includes('not valid')))

const missingSrc = jsonExit(run('install.js', [path.join(TMP, 'no-such-plugin'), '--target', clientDir]))
assert('missing source rejected', missingSrc.status === 1 && missingSrc.data.errors.some((e) => e.field === 'source'))

const fakeHome = path.join(TMP, 'fake-home')
const homeEnv = { ...process.env, HOME: fakeHome, USERPROFILE: fakeHome }
const claudeInst = jsonExit(run('install.js', [createdRoot, '--target', 'claude'], null, homeEnv))
assert(
  'claude target maps to ~/.claude/plugins',
  claudeInst.status === 0 && claudeInst.data.destination === path.join(fakeHome, '.claude', 'plugins', 'my-plugin'),
  JSON.stringify(claudeInst.data)
)

console.log('regression: extensions consistency')
const extDeclaredRoot = path.join(TMP, 'ext-declared')
fs.mkdirSync(extDeclaredRoot, { recursive: true })
fs.writeFileSync(
  path.join(extDeclaredRoot, 'plugin.json'),
  JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'ext-declared', extensions: { 'com.acme.ide': { theme: 'dark' } } })
)
const extDeclaredRes = jsonExit(run('validate.js', [extDeclaredRoot, '--json']))
assert(
  'declared extension without directory warns',
  extDeclaredRes.status === 0 &&
    extDeclaredRes.data.manifest.warnings.some((w) => w.message.includes("no 'com.acme.ide/' directory")),
  JSON.stringify(extDeclaredRes.data && extDeclaredRes.data.manifest.warnings)
)

const extDirOnlyRoot = path.join(TMP, 'ext-dir-only')
fs.mkdirSync(path.join(extDirOnlyRoot, 'com.acme.ide'), { recursive: true })
fs.writeFileSync(
  path.join(extDirOnlyRoot, 'plugin.json'),
  JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'ext-dir-only' })
)
fs.writeFileSync(path.join(extDirOnlyRoot, 'com.acme.ide', 'settings.json'), '{}')
const extDirOnlyRes = jsonExit(run('validate.js', [extDirOnlyRoot, '--json']))
assert(
  'namespace directory without declaration warns',
  extDirOnlyRes.status === 0 &&
    extDirOnlyRes.data.manifest.warnings.some((w) => w.message.includes('not declared in manifest extensions')),
  JSON.stringify(extDirOnlyRes.data && extDirOnlyRes.data.manifest.warnings)
)

const extOkRoot = path.join(TMP, 'ext-ok')
fs.mkdirSync(path.join(extOkRoot, 'com.acme.ide'), { recursive: true })
fs.writeFileSync(
  path.join(extOkRoot, 'plugin.json'),
  JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'ext-ok', extensions: { 'com.acme.ide': { theme: 'dark' } } })
)
fs.writeFileSync(path.join(extOkRoot, 'com.acme.ide', 'settings.json'), '{}')
const extOkRes = jsonExit(run('validate.js', [extOkRoot, '--json', '--strict']))
assert('consistent extension passes strict', extOkRes.status === 0, JSON.stringify(extOkRes.data && extOkRes.data.manifest.warnings))

console.log('regression: unsupported spec version guidance')
const futureRoot = path.join(TMP, 'future-plugin')
fs.mkdirSync(futureRoot, { recursive: true })
fs.writeFileSync(
  path.join(futureRoot, 'plugin.json'),
  JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/2.0.0/plugin.schema.json', name: 'future-plugin' })
)
const futureRes = jsonExit(run('validate.js', [futureRoot, '--json']))
assert(
  'future spec version gets targeted guidance',
  futureRes.status === 1 &&
    futureRes.data.manifest.errors.some((e) => e.message.includes('targets Agent Plugins 2.0.0') && e.message.includes('does not support yet')),
  JSON.stringify(futureRes.data && futureRes.data.manifest.errors)
)

console.log('doctor.js')
const docOkHome = path.join(TMP, 'doc-ok-home')
const docOkEnv = { ...process.env, HOME: docOkHome, USERPROFILE: docOkHome }
const docInstall = jsonExit(run('install.js', [createdRoot, '--target', 'claude'], null, docOkEnv))
assert('doctor fixture: plugin installed to fake claude target', docInstall.status === 0, docInstall.stderr)
const docRes = jsonExit(run('doctor.js', ['--json'], null, docOkEnv))
const docClaude = docRes.data.targets.find((t) => t.name === 'claude')
assert(
  'doctor reports node and finds installed plugin',
  docRes.status === 0 && docRes.data.node.ok === true && docClaude.plugins.length === 1 && docClaude.plugins[0].name === 'my-plugin' && docClaude.plugins[0].valid === true,
  JSON.stringify(docRes.data)
)

const docBadHome = path.join(TMP, 'doc-bad-home')
const docBadEnv = { ...process.env, HOME: docBadHome, USERPROFILE: docBadHome }
fs.mkdirSync(path.join(docBadHome, '.claude', 'plugins', 'future-plugin'), { recursive: true })
fs.writeFileSync(
  path.join(docBadHome, '.claude', 'plugins', 'future-plugin', 'plugin.json'),
  JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/2.0.0/plugin.schema.json', name: 'future-plugin' })
)
const docBadRes = jsonExit(run('doctor.js', ['--json'], null, docBadEnv))
const docBadClaude = docBadRes.data.targets.find((t) => t.name === 'claude')
assert(
  'doctor flags invalid plugin and exits 1',
  docBadRes.status === 1 && docBadClaude.plugins[0].valid === false && docBadRes.data.summary.invalidPlugins === 1,
  JSON.stringify(docBadRes.data)
)

const docExplicit = jsonExit(run('doctor.js', ['--json', '--target', clientDir]))
const docCustom = docExplicit.data.targets.find((t) => t.path === clientDir)
assert(
  'doctor scans explicit --target directory',
  docCustom && docCustom.plugins.some((p) => p.name === 'my-plugin' && p.valid === true),
  JSON.stringify(docExplicit.data && docExplicit.data.targets.map((t) => t.path))
)

console.log('lint.js')
const lintOkRes = jsonExit(run('lint.js', [createdRoot, '--json']))
assert('scaffolded plugin lints clean', lintOkRes.status === 0 && lintOkRes.data.clean === true && lintOkRes.data.linted === 2, JSON.stringify(lintOkRes.data))

const lintThinRoot = path.join(TMP, 'lint-thin')
fs.mkdirSync(path.join(lintThinRoot, 'skills', 'demo'), { recursive: true })
fs.writeFileSync(path.join(lintThinRoot, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'lint-thin' }))
fs.writeFileSync(
  path.join(lintThinRoot, 'skills/demo/SKILL.md'),
  '---\nname: demo\ndescription: A deliberately thin skill body used to verify lint quality findings.\n---\n\nShort body only.\n'
)
const lintThinRes = jsonExit(run('lint.js', [lintThinRoot, '--json']))
assert('thin skill produces findings and exits 1', lintThinRes.status === 1 && lintThinRes.data.clean === false)
assert(
  'thin body finding reported',
  lintThinRes.data.findings.some((f) => f.skill === 'demo' && f.field === 'body' && f.message.includes('body is thin')),
  JSON.stringify(lintThinRes.data.findings)
)
assert(
  'missing sections finding reported',
  lintThinRes.data.findings.some((f) => f.field === 'body' && f.message.includes('no ## section headings')),
  JSON.stringify(lintThinRes.data.findings)
)
assert(
  'missing title finding reported',
  lintThinRes.data.findings.some((f) => f.field === 'title' && f.message.includes('no # title heading')),
  JSON.stringify(lintThinRes.data.findings)
)

const lintAssetRoot = path.join(TMP, 'lint-asset')
fs.mkdirSync(path.join(lintAssetRoot, 'skills', 'demo', 'scripts'), { recursive: true })
fs.writeFileSync(path.join(lintAssetRoot, 'plugin.json'), JSON.stringify({ $schema: 'https://agent-plugins.org/schemas/1.0.0/plugin.schema.json', name: 'lint-asset' }))
fs.writeFileSync(path.join(lintAssetRoot, 'skills/demo/scripts/orphan.sh'), '#!/bin/sh\necho unused\n')
fs.writeFileSync(
  path.join(lintAssetRoot, 'skills/demo/SKILL.md'),
  '---\nname: demo\ndescription: A well-formed skill body that keeps the linter satisfied except for the orphan asset.\n---\n\n# Demo\n\n## When to use\n\n- Trigger one\n- Trigger two\n- Trigger three for good measure\n\n## Instructions\n\n1. Step one with a concrete detail\n2. Step two with another concrete detail\n3. Step three to make the body substantial enough\n'
)
const lintAssetRes = jsonExit(run('lint.js', [lintAssetRoot, '--json']))
assert(
  'unreferenced bundled file reported',
  lintAssetRes.status === 1 && lintAssetRes.data.findings.some((f) => f.field === 'assets' && f.message.includes("'scripts/orphan.sh' is never referenced")),
  JSON.stringify(lintAssetRes.data.findings)
)

const lintSkillDir = jsonExit(run('lint.js', [path.join(lintAssetRoot, 'skills', 'demo'), '--json']))
assert('single skill directory accepted', lintSkillDir.data.linted === 1 && lintSkillDir.data.findings.length === 1, JSON.stringify(lintSkillDir.data))

const lintNoSkills = jsonExit(run('lint.js', [path.join(TMP, 'no-server'), '--json']))
assert('plugin without skills lints clean', lintNoSkills.status === 0 && lintNoSkills.data.linted === 0 && lintNoSkills.data.clean === true)

console.log('lint examples')
for (const ex of ['hello-plugin', 'code-review-assistant', 'git-release-notes']) {
  const res = jsonExit(run('lint.js', [path.join(ROOT, 'examples', ex), '--json']))
  assert(`examples/${ex} lints clean`, res.status === 0 && res.data.clean === true, JSON.stringify(res.data))
}

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
