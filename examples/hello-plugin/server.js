#!/usr/bin/env node
'use strict'

const readline = require('readline')

const rl = readline.createInterface({ input: process.stdin })

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
          serverInfo: { name: 'greeter', version: '0.1.0' },
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
              name: 'greet',
              description: 'Return a greeting message',
              inputSchema: { type: 'object', properties: {} },
            },
          ],
        },
      }) + '\n'
    )
  } else if (msg.method === 'tools/call') {
    process.stdout.write(
      JSON.stringify({
        jsonrpc: '2.0',
        id: msg.id,
        result: { content: [{ type: 'text', text: 'Hello from the greeter plugin!' }] },
      }) + '\n'
    )
  }
})

rl.on('close', () => process.exit(0))
