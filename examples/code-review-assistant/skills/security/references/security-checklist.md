# Security Review Checklist

A categorized reference for security-focused code review. Use alongside the `security` skill.

## Injection

- [ ] SQL/NoSQL: parameterized queries or prepared statements everywhere; no string-concatenated queries
- [ ] ORM misuse: raw queries, `whereRaw`, dynamic `orderBy` with user input
- [ ] Command injection: no unsanitized input in `exec`/`system`/`spawn`/shell
- [ ] XSS: output encoding matches context (HTML, attribute, JS, URL, CSS)
- [ ] Path traversal: paths joined with untrusted input constrained to a base dir
- [ ] Deserialization: `pickle`, `eval`, `Function()`, unsafe YAML/XML parsers on untrusted data
- [ ] SSRF: URLs fetched from user input blocked for internal/loopback targets

## AuthN / AuthZ

- [ ] Every sensitive route/action checks auth
- [ ] Object-level authorization: user can only access their own resources
- [ ] No default/backdoor credentials
- [ ] Passwords: strong hashing (bcrypt/argon2/scrypt), not MD5/SHA1
- [ ] Sessions/tokens: expiry, rotation on privilege change, secure storage
- [ ] Rate limiting on login/register/password-reset

## Secrets

- [ ] No hardcoded keys/tokens/passwords in source or committed config
- [ ] No secrets in logs, error messages, or stack traces
- [ ] No secrets in client-side code or public assets
- [ ] Secrets referenced from environment/secret manager, with placeholder defaults

## Data handling

- [ ] TLS enforced; no HTTP downgrade or mixed content
- [ ] PII/financial data not logged or transmitted insecurely
- [ ] Sensitive files not world-readable; uploads validated by type/size/content
- [ ] Backups/caches do not expose sensitive data

## Dependencies

- [ ] No known-vulnerable versions introduced
- [ ] New deps are pinned and from trusted sources
- [ ] Upgrade of a dependency does not silently weaken security
