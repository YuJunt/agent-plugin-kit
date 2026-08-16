#!/usr/bin/env node
'use strict'

const fs = require('fs')
const path = require('path')
const zlib = require('zlib')
const crypto = require('crypto')
const { validate } = require('./validate')

function parseArgs(argv) {
  const args = { root: null, out: process.cwd(), help: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '-o' || arg === '--out') {
      i += 1
      args.out = argv[i]
    } else if (arg.startsWith('--out=')) {
      args.out = arg.slice('--out='.length)
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

function collectFiles(root) {
  const files = []
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir)) {
      const abs = path.join(dir, entry)
      const rel = prefix ? `${prefix}/${entry}` : entry
      const stat = fs.lstatSync(abs)
      if (stat.isSymbolicLink()) continue
      if (stat.isDirectory()) {
        walk(abs, rel)
      } else if (stat.isFile()) {
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

function pack(root, outDir) {
  const validation = validate(root)
  if (!validation.valid) {
    return { packed: false, errors: [{ message: `plugin is not valid; run validate first (${validation.summary.errors} errors)` }] }
  }

  const manifest = readManifest(root)
  const name = manifest && manifest.name ? manifest.name : path.basename(root)
  const version = manifest && manifest.version ? manifest.version : '0.1.0'

  fs.mkdirSync(outDir, { recursive: true })
  const archive = path.join(outDir, `${name}-${version}.tgz`)

  const files = collectFiles(root)
  const tar = buildTar(files)
  const tgz = zlib.gzipSync(tar, { level: 9 })

  const sha = crypto.createHash('sha256').update(tgz).digest('hex')
  fs.writeFileSync(archive, tgz)

  return {
    packed: true,
    archive,
    bytes: tgz.length,
    files: files.length,
    checksum: { algorithm: 'sha256', value: sha },
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.help) {
    console.log(
      `Usage: node scripts/pack.js <plugin-root> [-o <output-dir>]

Package a valid Agent Plugin into a .tgz tarball.

Options:
  -o, --out <dir>  Output directory (default: current directory)
  -h, --help       Show this help`
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

  const result = pack(args.root, args.out)
  console.log(JSON.stringify(result, null, 2))
  process.exit(result.packed ? 0 : 1)
}

module.exports = { pack }

if (require.main === module) {
  main()
}
