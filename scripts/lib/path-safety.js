'use strict'

const fs = require('fs')
const path = require('path')

function resolveWithin(root, target) {
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(root, target)
  if (resolvedTarget === resolvedRoot) return resolvedRoot
  if (resolvedTarget.startsWith(resolvedRoot + path.sep)) return resolvedTarget
  return null
}

function resolveWithinSymlinkAware(root, target) {
  const resolvedRoot = path.resolve(root)
  const resolvedTarget = path.resolve(root, target)
  if (!resolvedTarget.startsWith(resolvedRoot + path.sep)) return null

  const relative = path.relative(resolvedRoot, resolvedTarget)
  const parts = relative.split(path.sep)
  let current = resolvedRoot
  for (const part of parts) {
    current = path.join(current, part)
    let stats
    try {
      stats = fs.lstatSync(current)
    } catch {
      return resolvedTarget
    }
    if (stats.isSymbolicLink()) {
      let real
      try {
        real = fs.realpathSync(current)
      } catch {
        return resolvedTarget
      }
      if (!real.startsWith(resolvedRoot + path.sep) && real !== resolvedRoot) return null
    }
  }
  return resolvedTarget
}

function checkPackagePath(root, candidate) {
  const issues = []
  if (typeof candidate !== 'string' || candidate === '') {
    return issues
  }
  const resolved = resolveWithin(root, candidate)
  if (resolved === null) {
    issues.push({ path: candidate, message: 'path resolves outside the plugin root' })
    return issues
  }
  const symlinkAware = resolveWithinSymlinkAware(root, candidate)
  if (symlinkAware === null) {
    issues.push({ path: candidate, message: 'path escapes the plugin root through a symlink' })
  }
  return issues
}

function checkConfigPath(root, fieldPath, value, isCommand) {
  if (typeof value !== 'string' || value === '') {
    return []
  }
  if (value.startsWith('${PLUGIN_ROOT}') || value.startsWith('${PLUGIN_DATA}')) {
    return []
  }
  if (isCommand) {
    if (value.startsWith('./')) {
      return checkPackagePath(root, value)
    }
    return []
  }
  return []
}

module.exports = { resolveWithin, checkPackagePath, checkConfigPath }
