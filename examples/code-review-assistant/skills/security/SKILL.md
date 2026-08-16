---
name: security
description: Security-focused review of code changes, covering injection, secrets, auth, and data handling. Use when reviewing changes that touch authentication, user input, network, files, or credentials.
---

# Security Review

Perform a security-focused review of code changes. This is a defensive, best-practice review; it does not run any attack tools or exploit attempts.

## Input

- A diff or pull request touching security-relevant code
- The language/runtime context

## Security checklist

### Injection and validation
- SQL/NoSQL injection: are queries parameterized? Is user input escaped?
- Command injection: is user input passed to shell? Is it safely executed?
- XSS: is user output encoded for the context (HTML, attribute, JS, URL)?
- Path traversal: are file paths constructed from untrusted input constrained?
- Deserialization: are unsafe deserialization paths used with untrusted data?

### Authentication and authorization
- Is auth enforced on every sensitive endpoint/action? Missing checks?
- Weak passwords, default credentials, hardcoded tokens?
- Session/token handling: expiry, rotation, storage?
- Authorization: does it check the *resource owner*, not just "logged in"?

### Secrets and credentials
- Hardcoded API keys, passwords, or tokens in code or config?
- Secrets logged or exposed in error messages?
- Secrets in client-side code or public assets?

### Data handling
- Sensitive data (PII, financial) logged or transmitted insecurely?
- TLS enforced for transport? Is redirect downgrade possible?
- Data at rest: sensitive files world-readable?

### Dependencies
- Known-vulnerable dependency versions introduced or upgraded?
- Unpinned or suspicious dependencies added?

## Output format

Same severity format as the review skill:

```text
## Security findings
### [P1] Critical - <file>:<line> <vulnerability>
Description, why it matters, and a concrete fix.

### [P2] High ...
### [P3] Medium/Low ...
```

P1 = exploitable remotely or by an attacker. P2 = serious but requires more conditions. P3 = hardening improvements.

## Guidelines

- Report the *risk and a fix*, not just the symptom
- If uncertain whether something is exploitable, flag as P2/P3 with reasoning
- Do not run scanners or exploit payloads — this is a code-level review only

## Reference

See [references/security-checklist.md](references/security-checklist.md) for the full categorized checklist.
