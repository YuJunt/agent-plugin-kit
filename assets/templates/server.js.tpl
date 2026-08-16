#!/usr/bin/env node
'use strict'

const readline = require('readline')

const rl = readline.createInterface({ input: process.stdin })
const PLUGIN_ROOT = process.env.PLUGIN_ROOT || __dirname
const SERVER_NAME = '{{SERVER_NAME}}'

rl.on('line', (line) => {
  let msg
  try {
    msg = JSON.parse(line)
  } catch {
    return
  }

  if (msg.method === 'initialize') {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: SERVER_NAME, version: '0.1.0' },
        },
      }) + '\n'
    )
  } else if (msg.method === 'tools/list') {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: {
          tools: [
            {
              name: 'echo',
              description: 'Echo the input text back to the caller.',
              inputSchema: {
                type: 'object',
                properties: { text: { type: 'string' } },
                required: ['text'],
              },
            },
          ],
        },
      }) + '\n'
    )
  } else if (msg.method === 'tools/call') {
    const { name, arguments: args } = msg.params
    if (name === 'echo') {
      process.stdout.write(
        JSON.stringify({
          jsonrpc: '2.0',
          id: msg.id,
          result: { content: [{ type: 'text', text: String(args && args.text) }] },
        }) + '\n'
      )
    }
  }
})

rl.on('close', () => process.exit(0))
