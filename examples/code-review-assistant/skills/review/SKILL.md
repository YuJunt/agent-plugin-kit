---
name: review
description: Performs thorough code reviews with a structured checklist covering correctness, design, readability, tests, and consistency. Use when asked to review code, pull requests, or changes.
---

# Code Review

Conduct a systematic code review following the checklist below. Read each item, inspect the code, and record findings as a review report.

## Input

- A diff, pull request, or set of files to review
- Context about the project conventions when available

## Review checklist

### 1. Correctness
- Does the code do what it claims?
- Are edge cases handled (empty input, null, zero, large values, concurrency)?
- Are there obvious bugs or off-by-one errors?

### 2. Design and architecture
- Single responsibility: does each function/class do one thing?
- Appropriate abstraction level — no over- or under-engineering
- DRY: is there unnecessary duplication?
- Coupling: would changes ripple through the system?
- Extensibility: can future requirements be added cleanly?

### 3. Readability and maintainability
- Clear, meaningful names (avoid `data`, `temp`, `a`, `b`)
- Simplicity: could this be more direct?
- Comments explain *why*, not *what*
- Code smells: long functions, deep nesting, god objects

### 4. Tests and robustness
- Are there tests? Do they test real logic, not just pass-through?
- Is error handling present for likely failures (API calls, file I/O, DB)?
- Does the user see friendly errors instead of crashes?

### 5. Consistency
- Does it follow project style and conventions?
- Are debug logs, dead code, or commented-out blocks present?

### 6. Performance and security
- Obvious bottlenecks (queries in loops, full table scans, leaks)?
- Common vulnerabilities (SQL injection, XSS, hardcoded secrets, weak auth)?

## Output format

Produce a report with:

```text
## Review summary
Overall assessment (approve / needs-changes / reject)

## Findings
### [P1] Critical - <file>:<line> <title>
Description and suggested fix.

### [P2] Major ...
### [P3] Minor ...

## Strengths
- What was done well

## Suggestions
- Optional improvements
```

Severity guide: P1 blocks merge, P2 should fix before merge, P3 can be addressed later.

## Edge cases

- Empty diff: state that there is nothing to review
- Very large diff: prioritize P1/P2 and summarize patterns instead of line-by-line
- Third-party generated code: focus on integration points, not internal style
