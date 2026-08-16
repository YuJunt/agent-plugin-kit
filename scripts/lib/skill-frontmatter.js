'use strict'

const fs = require('fs')
const path = require('path')

const SKILL_NAME_RE = /^(?!.*--)[a-z0-9]+(?:-[a-z0-9]+)*$/

const KNOWN_FRONTMATTER_FIELDS = new Set([
  'name',
  'description',
  'license',
  'compatibility',
  'metadata',
  'allowed-tools',
  'version',
])

function resolveRefsInBody(body, skillDir, warnings) {
  if (!skillDir || typeof body !== 'string') return
  const refs = new Set()

  const mdLinkRe = /\[[^\]]*\]\(([^)]+)\)/g
  let m
  while ((m = mdLinkRe.exec(body)) !== null) {
    let target = m[1]
    if (target.startsWith('http://') || target.startsWith('https://') || target.startsWith('#')) continue
    target = target.split('#')[0]
    if (target) refs.add(target)
  }

  const codeRefRe = /^\s*(?:scripts\/|references\/|assets\/)\S+/gm
  while ((m = codeRefRe.exec(body)) !== null) {
    refs.add(m[0].trim().split(/\s+/)[0])
  }

  for (const ref of refs) {
    const resolved = path.join(skillDir, ref)
    if (!fs.existsSync(resolved)) {
      warnings.push({ field: 'body', message: `referenced file '${ref}' does not exist` })
    }
  }
}

function parseFrontmatter(content) {
  if (typeof content !== 'string') return { ok: false, error: 'SKILL.md content must be a string' }
  if (!content.startsWith('---')) {
    return { ok: false, error: 'SKILL.md must start with --- frontmatter delimiter' }
  }
  const end = content.indexOf('\n---', 3)
  if (end === -1) {
    return { ok: false, error: 'SKILL.md frontmatter is missing the closing --- delimiter' }
  }
  const raw = content.slice(3, end)
  const body = content.slice(end + 4)
  return { ok: true, frontmatter: parseYamlLike(raw), body }
}

function parseYamlLike(raw) {
  const result = {}
  const lines = raw.split('\n')
  const stack = [] // frames: { indent, key, obj }
  let currentObj = result
  let currentKey = null
  let currentIndent = -1

  const flush = () => {
    if (currentKey !== null && currentObj && !(currentKey in currentObj)) {
      currentObj[currentKey] = null
    }
  }

  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const indent = line.match(/^\s*/)[0].length
    const content = line.slice(indent).trim()
    const colon = content.indexOf(':')
    if (colon === -1) {
      currentKey = null
      continue
    }
    const key = content.slice(0, colon).trim()
    let value = content.slice(colon + 1).trim()

    while (stack.length > 0 && indent <= stack[stack.length - 1].indent) {
      stack.pop()
    }
    if (stack.length === 0) {
      currentObj = result
    } else {
      currentObj = stack[stack.length - 1].obj
    }

    if (value === '' || value === '|' || value === '>') {
      const obj = {}
      if (indent >= currentIndent) {
        currentObj[key] = obj
      }
      stack.push({ indent, key, obj })
      currentObj = obj
      currentKey = null
      currentIndent = indent
      continue
    }

    currentObj[key] = parseScalar(value)
    currentKey = key
    currentIndent = indent
  }

  return result
}

function parseScalar(value) {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1).replace(/\\"/g, '"').replace(/\\n/g, '\n')
  }
  if (value.length >= 2 && value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'")
  }
  return value
}

function validateSkillName(name) {
  if (typeof name !== 'string') return ['name must be a string']
  if (name.length < 1 || name.length > 64) return ['name must be between 1 and 64 characters']
  if (!/^[a-z0-9-]+$/.test(name)) return ['name may only contain lowercase alphanumeric characters and hyphens']
  if (/^-|-$/.test(name)) return ['name must not start or end with a hyphen']
  if (/--/.test(name)) return ['name must not contain consecutive hyphens']
  return []
}

function validateAllowedTools(value) {
  if (typeof value !== 'string') return ['allowed-tools must be a space-separated string']
  const tools = value.split(/\s+/).filter(Boolean)
  if (tools.length === 0) return ['allowed-tools must list at least one tool name']
  const bad = tools.filter((t) => !/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(t))
  if (bad.length > 0) return [`allowed-tools contains invalid tool name(s): ${bad.join(', ')}`]
  return []
}

function validateSkill(filePath, content, dirName) {
  const errors = []
  const warnings = []
  const skillDir = filePath ? path.dirname(filePath) : null
  const parsed = parseFrontmatter(content)

  if (!parsed.ok) {
    errors.push({ field: 'frontmatter', message: parsed.error })
    return { valid: false, errors, warnings }
  }

  const fm = parsed.frontmatter

  for (const key of Object.keys(fm)) {
    if (!KNOWN_FRONTMATTER_FIELDS.has(key)) {
      warnings.push({ field: key, message: `unknown frontmatter field '${key}' is ignored` })
    }
  }

  if (fm.name === undefined || fm.name === null || fm.name === '') {
    errors.push({ field: 'name', message: 'required field name is missing or empty' })
  } else {
    for (const err of validateSkillName(fm.name)) {
      errors.push({ field: 'name', message: err })
    }
    if (dirName && fm.name !== dirName) {
      errors.push({ field: 'name', message: `name '${fm.name}' must match the parent directory name '${dirName}'` })
    }
  }

  if (fm.description === undefined || fm.description === null || fm.description === '') {
    errors.push({ field: 'description', message: 'required field description is missing or empty' })
  } else if (typeof fm.description !== 'string') {
    errors.push({ field: 'description', message: 'description must be a string' })
  } else if (fm.description.length > 1024) {
    errors.push({ field: 'description', message: 'description must be at most 1024 characters' })
  }

  if (fm.description && fm.description.length < 20) {
    warnings.push({ field: 'description', message: 'description is very short; include what the skill does and when to use it' })
  }

  if (fm.compatibility !== undefined && typeof fm.compatibility !== 'string') {
    errors.push({ field: 'compatibility', message: 'compatibility must be a string' })
  }
  if (fm.license !== undefined && typeof fm.license !== 'string') {
    errors.push({ field: 'license', message: 'license must be a string' })
  }
  if (fm.metadata !== undefined && (fm.metadata === null || typeof fm.metadata !== 'object' || Array.isArray(fm.metadata))) {
    errors.push({ field: 'metadata', message: 'metadata must be a map of strings' })
  } else if (fm.metadata !== undefined) {
    for (const [k, v] of Object.entries(fm.metadata)) {
      if (typeof v !== 'string') {
        errors.push({ field: `metadata.${k}`, message: 'metadata value must be a string' })
      }
    }
  }

  if (fm['allowed-tools'] !== undefined) {
    for (const err of validateAllowedTools(fm['allowed-tools'])) {
      errors.push({ field: 'allowed-tools', message: err })
    }
  }

  if (fm.version !== undefined && typeof fm.version !== 'string') {
    errors.push({ field: 'version', message: 'version must be a string' })
  }

  if (!parsed.body || !parsed.body.trim()) {
    warnings.push({ field: 'body', message: 'SKILL.md body is empty; add instructions' })
  } else {
    resolveRefsInBody(parsed.body, skillDir, warnings)
  }

  return { valid: errors.length === 0, errors, warnings, frontmatter: fm }
}

module.exports = { validateSkill, parseFrontmatter, validateSkillName, validateAllowedTools }
