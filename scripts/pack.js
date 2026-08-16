#!/usr/bin/env node
'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')
const zlib = require('zlib')
const crypto = require('crypto')
const { validate } = require('./validate')

function parseArgs(argv) {
  const args = { root: null, out: process.cwd(), help: false, dryRun: false, verify: false, include: [], exclude: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '-o' || arg === '--out') {
      i += 1
      args.out = argv[i]
    } else if (arg.startsWith('--out=')) {
      args.out = arg.slice('--out='.length)
    } else if (arg === '--dry-run') {
      args.dryRun = true
    } else if (arg === '--verify') {
      args.verify = true
    } else if (arg === '--include') {
      i += 1
      for (const p of (argv[i] || '').split(',')) if (p) args.include.push(p)
    } else if (arg.startsWith('--include=')) {
      for (const p of arg.slice('--include='.length).split(',')) if (p) args.include.push(p)
    } else if (arg === '--exclude') {
      i += 1
      for (const p of (argv[i] || '').split(',')) if (p) args.exclude.push(p)
    } else if (arg.startsWith('--exclude=')) {
      for (const p of arg.slice('--exclude='.length).split(',')) if (p) args.exclude.push(p)
    } else if (arg === '-h' || arg === '--help') {
      args.help = true
    } else if (arg.startsWith('-')) {
      console.error(`Unknown option: ${arg}`)
      args.help = true
    } else if (args.root === null) {
      args.root = arg
    }
  }
  return args
}

const EXCLUDE_DIRS = new Set(['.git', 'node_modules', '.hg', '.svn', 'dist', 'build'])
const EXCLUDE_FILES = new Set(['.DS_Store', 'Thumbs.db'])

const CORE_FILES = (root) => new Set(['plugin.json', 'mcp.json', 'skills'])

function globToRegExp(glob) {
  let out = ''
  for (let i = 0; i < glob.length; i += 1) {
    const ch = glob[i]
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        out += '.*'
        i += 1
      } else {
        out += '[^/]*'
      }
    } else if (ch === '?') {
      out += '[^/]'
    } else if ('\\^$.|+()[]{}'.includes(ch)) {
      out += '\\' + ch
    } else {
      out += ch
    }
  }
  return new RegExp(`^${out}$`)
}

function matchesAny(rel, patterns) {
  return patterns.some((p) => globToRegExp(p).test(rel))
}

function isCore(rel, root) {
  if (rel === 'plugin.json' || rel === 'mcp.json') return true
  if (/^skills\/[^/]+\/SKILL\.md$/.test(rel)) return true
  return false
}

function collectFiles(root, opts) {
  const include = opts && opts.include
  const exclude = opts && opts.exclude
  const files = []
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir)) {
      const abs = path.join(dir, entry)
      const rel = prefix ? `${prefix}/${entry}` : entry
      const stat = fs.lstatSync(abs)
      if (stat.isSymbolicLink()) continue
      if (stat.isDirectory()) {
        if (EXCLUDE_DIRS.has(entry)) continue
        walk(abs, rel)
      } else if (stat.isFile()) {
        if (EXCLUDE_FILES.has(entry)) continue
        if (exclude && exclude.length > 0 && matchesAny(rel, exclude)) continue
        if (include && include.length > 0 && !isCore(rel, root) && !matchesAny(rel, include)) continue
        files.push({ abs, rel, size: stat.size, mtime: Math.floor(stat.mtimeMs / 1000) })
      }
    }
  }
  walk(root, '')
  files.sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
  return files
}

function toTarHeader(file) {
  const name = file.rel
  const buffer = Buffer.alloc(512)
  buffer.write(name, 0, 100, 'utf8')
  const mode = (0o644).toString(8).padStart(7, '0')
  buffer.write(mode, 100, 7, 'utf8')
  const uid = '0000000'
  buffer.write(uid, 108, 7, 'utf8')
  const gid = '0000000'
  buffer.write(gid, 116, 7, 'utf8')
  const size = file.size.toString(8).padStart(11, '0')
  buffer.write(size, 124, 11, 'utf8')
  const mtime = file.mtime.toString(8).padStart(11, '0')
  buffer.write(mtime, 136, 11, 'utf8')
  buffer.write('        ', 148, 8, 'utf8')
  buffer.write('0', 156, 1, 'utf8')
  buffer.write(name, 157, 100, 'utf8')
  buffer.write('ustar', 257, 6, 'utf8')
  buffer.write('00', 263, 2, 'utf8')
  let checksum = 0
  for (let i = 0; i < 512; i += 1) checksum += buffer[i]
  const checksumStr = checksum.toString(8).padStart(6, '0')
  buffer.write(checksumStr, 148, 6, 'utf8')
  buffer.write('\0', 154, 1, 'utf8')
  buffer.write(' ', 155, 1, 'utf8')
  return buffer
}

function buildTar(files) {
  const chunks = []
  let total = 0
  for (const file of files) {
    const header = toTarHeader(file)
    chunks.push(header)
    total += 512
    if (file.size > 0) {
      const data = fs.readFileSync(file.abs)
      chunks.push(data)
      const padding = (512 - (file.size % 512)) % 512
      if (padding > 0) chunks.push(Buffer.alloc(padding))
      total += file.size + padding
    }
  }
  chunks.push(Buffer.alloc(1024))
  return Buffer.concat(chunks, total + 1024)
}

function readManifest(root) {
  try {
    const raw = fs.readFileSync(path.join(root, 'plugin.json'), 'utf8')
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function extractTar(tgzBuffer) {
  const tar = zlib.gunzipSync(tgzBuffer)
  const files = []
  let offset = 0
  while (offset + 512 <= tar.length) {
    if (tar[offset] === 0) break
    const name = tar.toString('utf8', offset, offset + 100).replace(/\0.*$/, '').trim()
    const sizeStr = tar.toString('utf8', offset + 124, offset + 136).replace(/\0.*$/, '').trim()
    const size = sizeStr ? parseInt(sizeStr, 8) : 0
    const data = Buffer.from(tar.slice(offset + 512, offset + 512 + size))
    if (name) files.push({ name, size, data })
    offset += 512 + Math.ceil(size / 512) * 512
  }
  return files
}

function verifyArchive(archive, validateFn) {
  const tgz = fs.readFileSync(archive)
  const files = extractTar(tgz)
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'apk-verify-'))
  try {
    for (const f of files) {
      const dest = path.join(tmp, f.name)
      fs.mkdirSync(path.dirname(dest), { recursive: true })
      fs.writeFileSync(dest, f.data)
    }
    const validation = validateFn ? validateFn(tmp) : validate(tmp)
    return { valid: validation.valid, fileCount: files.length, errors: validation.summary.errors, warnings: validation.summary.warnings }
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true })
  }
}

function pack(root, outDir, opts) {
  const options = opts || {}
  const validation = validate(root)
  if (!validation.valid) {
    return { packed: false, errors: [{ message: `plugin is not valid; run validate first (${validation.summary.errors} errors)` }] }
  }

  const manifest = readManifest(root)
  const name = manifest && manifest.name ? manifest.name : path.basename(root)
  const version = manifest && manifest.version ? manifest.version : '0.1.0'

  const files = collectFiles(root, { include: options.include, exclude: options.exclude })
  const fileList = files.map((f) => f.rel)

  if (options.dryRun) {
    return {
      packed: false,
      dryRun: true,
      name,
      version,
      files: fileList,
      bytes: files.reduce((sum, f) => sum + f.size, 0),
    }
  }

  fs.mkdirSync(outDir, { recursive: true })
  const archive = path.join(outDir, `${name}-${version}.tgz`)

  const tar = buildTar(files)
  const tgz = zlib.gzipSync(tar, { level: 9 })

  const sha = crypto.createHash('sha256').update(tgz).digest('hex')
  fs.writeFileSync(archive, tgz)

  const result = {
    packed: true,
    archive,
    bytes: tgz.length,
    files: files.length,
    checksum: { algorithm: 'sha256', value: sha },
  }

  if (options.verify) {
    result.verify = verifyArchive(archive, options.validate)
  }

  return result
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(
      `Usage: node scripts/pack.js <plugin-root> [-o <output-dir>] [options]

Package a valid Agent Plugin into a .tgz tarball.

Options:
  -o, --out <dir>      Output directory (default: current directory)
      --include <globs> Comma-separated globs of files to include (core files are always kept)
      --exclude <globs> Comma-separated globs of files to exclude (on top of defaults)
      --dry-run         List the files that would be packaged without writing an archive
      --verify          Unpack the archive into a temp dir, re-validate it, and report
  -h, --help           Show this help`
    )
    process.exit(0)
  }
  if (!args.root) {
    console.error('Usage: node scripts/pack.js <plugin-root> [-o <output-dir>]')
    process.exit(1)
  }
  if (!fs.existsSync(args.root)) {
    console.error(`Plugin root not found: ${args.root}`)
    process.exit(1)
  }

  const result = pack(args.root, args.out, { dryRun: args.dryRun, verify: args.verify, include: args.include, exclude: args.exclude })
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.packed || result.dryRun ? 0 : 1)
}

module.exports = { pack, extractTar, verifyArchive, globToRegExp }

if (require.main === module) {
  main()
}
