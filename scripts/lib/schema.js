'use strict'

function resolveRef(ref, rootSchema) {
  if (!ref.startsWith('#/')) return null
  const parts = ref.slice(2).split('/').map((p) => p.replace(/~1/g, '/').replace(/~0/g, '~'))
  let node = rootSchema
  for (const part of parts) {
    if (node == null || typeof node !== 'object') return null
    node = node[part]
  }
  return node
}

function validate(value, schema, rootSchema, path) {
  const errors = []
  const current = rootSchema || schema
  path = path || ''

  if (schema.$ref) {
    const target = resolveRef(schema.$ref, current)
    if (!target) {
      errors.push({ path, message: `Unresolvable $ref: ${schema.$ref}` })
      return errors
    }
    return validate(value, target, current, path)
  }

  if (schema.type !== undefined) {
    const types = Array.isArray(schema.type) ? schema.type : [schema.type]
    let ok = false
    for (const t of types) {
      if (t === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) ok = true
      else if (t === 'array' && Array.isArray(value)) ok = true
      else if (t === 'string' && typeof value === 'string') ok = true
      else if (t === 'number' && typeof value === 'number' && !Number.isNaN(value)) ok = true
      else if (t === 'integer' && Number.isInteger(value)) ok = true
      else if (t === 'boolean' && typeof value === 'boolean') ok = true
      else if (t === 'null' && value === null) ok = true
    }
    if (!ok) {
      errors.push({ path: path || '#', message: `Expected type ${types.join('|')}, got ${typeName(value)}` })
      return errors
    }
  }

  if (schema.const !== undefined) {
    if (JSON.stringify(value) !== JSON.stringify(schema.const)) {
      errors.push({ path: path || '#', message: `Expected const ${JSON.stringify(schema.const)}` })
    }
  }

  if (Array.isArray(schema.enum)) {
    if (!schema.enum.some((e) => JSON.stringify(e) === JSON.stringify(value))) {
      errors.push({ path: path || '#', message: `Value must be one of ${JSON.stringify(schema.enum)}` })
    }
  }

  if (typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({ path: path || '#', message: `Length must be >= ${schema.minLength}` })
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({ path: path || '#', message: `Length must be <= ${schema.maxLength}` })
    }
    if (schema.pattern !== undefined) {
      const re = new RegExp(schema.pattern)
      if (!re.test(value)) {
        errors.push({ path: path || '#', message: `Value does not match pattern ${schema.pattern}` })
      }
    }
  }

  if (schema.oneOf && Array.isArray(schema.oneOf)) {
    let matchCount = 0
    const allErrors = []
    for (const sub of schema.oneOf) {
      const subErrors = validate(value, sub, current, path)
      if (subErrors.length === 0) matchCount += 1
      else allErrors.push(subErrors)
    }
    if (matchCount !== 1) {
      errors.push({ path: path || '#', message: `Value must match exactly one of ${schema.oneOf.length} variants` })
    }
  }

  if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
    if (Array.isArray(schema.required)) {
      for (const req of schema.required) {
        if (!(req in value)) {
          errors.push({ path: path || '#', message: `Missing required property '${req}'` })
        }
      }
    }
    if (schema.properties && typeof schema.properties === 'object') {
      for (const [key, propSchema] of Object.entries(schema.properties)) {
        if (key in value) {
          const childErrors = validate(value[key], propSchema, current, `${path}/${key}`)
          errors.push(...childErrors)
        }
      }
    }
    if (schema.additionalProperties !== undefined) {
      const allowed = new Set(Object.keys(schema.properties || {}))
      for (const key of Object.keys(value)) {
        if (allowed.has(key)) continue
        if (schema.additionalProperties === false) {
          errors.push({ path: `${path}/${key}`, message: `Additional property '${key}' is not allowed` })
        } else if (typeof schema.additionalProperties === 'object' && schema.additionalProperties !== null) {
          const childErrors = validate(value[key], schema.additionalProperties, current, `${path}/${key}`)
          errors.push(...childErrors)
        }
      }
    }
  }

  if (Array.isArray(value) && schema.items) {
    for (let i = 0; i < value.length; i += 1) {
      const childErrors = validate(value[i], schema.items, current, `${path}/${i}`)
      errors.push(...childErrors)
    }
  }

  return errors
}

function typeName(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value
}

module.exports = { validate }
