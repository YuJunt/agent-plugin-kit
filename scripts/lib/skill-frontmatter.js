'use strict'

const SKILL_NAME_RE = /^(?!.*--)[a-z0-9]+(?:-[a-z0-9]+)*$/

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

function validateSkill(filePath, content, dirName) {
  const errors = []
  const warnings = []
  const parsed = parseFrontmatter(content)

  if (!parsed.ok) {
    errors.push({ field: 'frontmatter', message: parsed.error })
    return { valid: false, errors, warnings }
  }

  const fm = parsed.frontmatter

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

  if (!parsed.body || !parsed.body.trim()) {
    warnings.push({ field: 'body', message: 'SKILL.md body is empty; add instructions' })
  }

  return { valid: errors.length === 0, errors, warnings, frontmatter: fm }
}

module.exports = { validateSkill, parseFrontmatter, validateSkillName }
