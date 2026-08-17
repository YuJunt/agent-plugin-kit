#!/usr/bin/env node
'use strict'

const path = require('path')
const { spawnSync } = require('child_process')

const scripts = {
  create: 'create.js',
  validate: 'validate.js',
  pack: 'pack.js',
  install: 'install.js',
  doctor: 'doctor.js',
}

const subcommand = process.argv[2]
const script = scripts[subcommand]

if (!script) {
  console.log(`agent-plugin - Agent Plugins development tool (Agent Skill)

Usage: agent-plugin <command> [args]

Commands:
  create    Scaffold a new Agent Plugin skeleton
  validate  Validate a plugin directory against the 1.0.0 spec
  pack      Package a valid plugin into a .tgz tarball
  install   Install a plugin into a client plugin directory
  doctor    Diagnose the environment and installed plugins

Run 'agent-plugin <command> --help' for command details.
`)
  process.exit(subcommand ? 1 : 0)
}

const scriptPath = path.join(__dirname, '..', script)
const result = spawnSync(process.execPath, [scriptPath, ...process.argv.slice(3)], { stdio: 'inherit' })
process.exit(result.status ?? 1)
