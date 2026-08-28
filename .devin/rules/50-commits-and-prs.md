---
trigger: always_on
---

# Commits & PRs

- Subject line ≤54 chars, imperative mood, prefix subsystem in brackets:
  `[Telemetry] Handle empty request response`.
- Body wraps at ~72 chars. Reference issue: `Closes #1234` or
  `Addresses #1234`.
- Every PR links to an issue and includes testing instructions.
- Do not squash lint/format fixes into unrelated commits.
- Changes to public API require senior-developer approval per
  `CONTRIBUTING.md`.
