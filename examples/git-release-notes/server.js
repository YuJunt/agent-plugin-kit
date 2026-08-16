#!/usr/bin/env node
'use strict'

const { execFileSync } = require('child_process')

const rl = require('readline').createInterface({ input: process.stdin })
const baseDir = process.env.PLUGIN_ROOT || __dirname

const TOOLS = [
  {
    name: 'get_commit_log',
    description: 'Return formatted git commit log for a revision range.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Start ref (default: oldest of range or first tag).' },
        to: { type: 'string', description: 'End ref (default: HEAD).' },
        count: { type: 'number', description: 'Max commits (default 50).' },
      },
    },
  },
  {
    name: 'get_latest_tag',
    description: 'Return the most recent git tag (version).',
    inputSchema: { type: 'object', properties: {} },
  },
]

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`)
}

function runGit(args) {
  return execFileSync('git', args, { cwd: baseDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function handleToolCall(params) {
  const { name, arguments: args } = params
  if (name === 'get_commit_log') {
    const count = args && args.count ? String(args.count) : '50'
    const range = args && args.from ? `${args.from}..${args.to || 'HEAD'}` : `-n ${count}`
    const format = '%h%x09%an%x09%ad%x09%s'
    const out = runGit(['log', '--date=short', `--pretty=format:${format}`].concat(args && args.from ? [range] : []))
    return { content: [{ type: 'text', text: out || '(no commits)' }] }
  }
  if (name === 'get_latest_tag') {
    try {
      const out = runGit(['describe', '--tags', '--abbrev=0'])
      return { content: [{ type: 'text', text: out.trim() || '(no tags)' }] }
    } catch {
      return { content: [{ type: 'text', text: '(no tags)' }] }
    }
  }
  throw new Error(`Unknown tool: ${name}`)
}

rl.on('line', (line) => {
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }
  if (msg.method === 'initialize') {
    send({
      jsonrpc: '2.0',
      id: msg.id,
      result: {
        protocolVersion: '2025-06-18',
        capabilities: { tools: {} },
        serverInfo: { name: 'git-history', version: '0.1.0' },
      },
    })
  } else if (msg.method === 'tools/list') {
    send({ jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } })
  } else if (msg.method === 'tools/call') {
    try {
      send({ jsonrpc: '2.0', id: msg.id, result: handleToolCall(msg.params) })
    } catch (e) {
      send({ jsonrpc: '2.0', id: msg.id, error: { code: -32000, message: String(e.message) } })
    }
  } else if (msg.method === 'ping') {
    send({ jsonrpc: '2.0', id: msg.id, result: {} })
  }
})

rl.on('close', () => process.exit(0))
