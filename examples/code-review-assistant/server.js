#!/usr/bin/env node
'use strict'

const { execFileSync } = require('child_process')
const path = require('path')

const rl = require('readline').createInterface({ input: process.stdin })
const baseDir = process.env.PLUGIN_ROOT || __dirname

const TOOLS = [
  {
    name: 'get_git_diff',
    description:
      'Return the current uncommitted diff in the plugin repository, or the diff between two git refs.',
    inputSchema: {
      type: 'object',
      properties: {
        from: { type: 'string', description: 'Optional base ref or commit. Defaults to HEAD.' },
        to: { type: 'string', description: 'Optional target ref. Defaults to working tree.' },
        path: { type: 'string', description: 'Optional path filter inside the repo.' },
      },
    },
  },
  {
    name: 'get_git_status',
    description: 'Return a short git status of the repository.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_recent_commits',
    description: 'Return the recent commit log (oneline) of the repository.',
    inputSchema: {
      type: 'object',
      properties: { count: { type: 'number', description: 'Number of commits, default 10.' } },
    },
  },
]

function send(msg) {
  process.stdout.write(`${JSON.stringify(msg)}\n`)
}

function fail(id, error) {
  send({ jsonrpc: '2.0', id, error: { code: -32000, message: String(error) } })
}

function runGit(args) {
  return execFileSync('git', args, { cwd: baseDir, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

function handleToolCall(params) {
  const { name, arguments: args } = params
  if (name === 'get_git_diff') {
    const from = args && args.from ? args.from : 'HEAD'
    const to = args && args.to ? args.to : ''
    const cmd = ['diff', from]
    if (to) cmd.push(to)
    if (args && args.path) {
      cmd.push('--')
      cmd.push(args.path)
    }
    const out = runGit(cmd)
    return { content: [{ type: 'text', text: out || '(no diff)' }] }
  }
  if (name === 'get_git_status') {
    const out = runGit(['status', '--short'])
    return { content: [{ type: 'text', text: out || '(clean working tree)' }] }
  }
  if (name === 'get_recent_commits') {
    const count = args && args.count ? String(args.count) : '10'
    const out = runGit(['log', '-n', count, '--oneline'])
    return { content: [{ type: 'text', text: out || '(no commits)' }] }
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
        serverInfo: { name: 'git-diff', version: '0.1.0' },
      },
    })
  } else if (msg.method === 'notifications/initialized') {
    // no-op
  } else if (msg.method === 'tools/list') {
    send({ jsonrpc: '2.0', id: msg.id, result: { tools: TOOLS } })
  } else if (msg.method === 'tools/call') {
    try {
      send({ jsonrpc: '2.0', id: msg.id, result: handleToolCall(msg.params) })
    } catch (e) {
      fail(msg.id, e.message)
    }
  } else if (msg.method === 'ping') {
    send({ jsonrpc: '2.0', id: msg.id, result: {} })
  }
})

rl.on('close', () => process.exit(0))
