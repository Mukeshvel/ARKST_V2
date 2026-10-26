# Historical Milestone 1 status — 2026-10-26

This is the preserved pre-Milestone-2 report. For current implementation and limits,
read PROJECT_STATUS.md. Statements below describe the earlier baseline only.

## Milestone 1 implemented

Empty working directory inspected before creation; it was not a Git repository.
Local Git repository initialized. No existing work overwritten, commits created,
remote configured, migrations applied, deployments made or pushes performed.

Implemented: static responsive foundation page; strict TypeScript; lint/format scripts;
25 unit tests for completion accounting, configurable time boundaries and environment
validation; an executable production HTTP smoke test; the architecture/domain/security
proposals. No real student information or demo academic records are present.

## Verification evidence

Environment: Windows PowerShell, Node 24.19.0, npm 11.17.0.

| Command                                                                                                                                                                                 | Actual result                                                                                                        |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `npm install --save-exact next@16.4.3 react@latest react-dom@latest`                                                                                                                    | Passed; exact resolved versions saved below.                                                                         |
| `npm install --save-dev --save-exact typescript@latest @types/node@24 @types/react@latest @types/react-dom@latest eslint@latest eslint-config-next@16.4.3 prettier@latest vitest@5.0.5` | Installed, but peer warnings required corrections described below.                                                   |
| `npm install --save-dev --save-exact typescript@5.9.3`                                                                                                                                  | Installed compatible TypeScript; remaining ESLint peer warnings.                                                     |
| `npm install --save-dev --save-exact eslint@9.39.5`                                                                                                                                     | Installed, but npm marked ESLint 9 unsupported; this version was removed.                                            |
| `npm uninstall eslint-config-next`                                                                                                                                                      | Passed.                                                                                                              |
| `npm install --save-dev --save-exact eslint@10.13.0 typescript-eslint@8.72.0 @next/eslint-plugin-next@16.4.3`                                                                           | Passed without peer warnings. Final supported lint configuration.                                                    |
| `npm run typecheck`                                                                                                                                                                     | Passed (Next route generation and strict tsc).                                                                       |
| `npm run lint`                                                                                                                                                                          | Passed with zero warnings.                                                                                           |
| `npm test`                                                                                                                                                                              | Passed: 2 files, 25 tests. Initial ESM configuration warning corrected with package type module; clean rerun passed. |
| `npm run format` / `npm run format:check`                                                                                                                                               | Applied conventions; check passed.                                                                                   |
| `npm run build`                                                                                                                                                                         | Passed: optimized Turbopack build, static `/` and `/_not-found`.                                                     |
| `npm start -- --hostname 127.0.0.1 --port 3100`                                                                                                                                         | Production server started successfully.                                                                              |
| `$env:SMOKE_ORIGIN='http://127.0.0.1:3100'; npm run test:smoke`                                                                                                                         | Passed: HTTP 200 HTML, foundation notice, no forms/buttons/inputs, `/api/students` HTTP 404.                         |
| `npm ls --all --json`                                                                                                                                                                   | Exit 0; no invalid required peers. Optional unused/platform-specific packages may be absent.                         |
| `npm audit --audit-level=low`                                                                                                                                                           | Passed: zero reported vulnerabilities at verification time; not a security certification.                            |
| `git ls-files` / `git check-ignore node_modules .next .env.local .env.example`                                                                                                          | No tracked files yet; generated directories and local secrets ignored; example is not ignored.                       |
| `rg` scan of source/config/docs for private-key blocks, secret-key/JWT patterns                                                                                                         | No matches. Manual review found placeholders only; not an exhaustive secret scanner.                                 |

Initial sandbox npm metadata queries failed with ENOTFOUND; registry access succeeded
with approved network access. Initial smoke attempts failed with EACCES and ETIMEDOUT
across the sandbox boundary; placing the server and test in the same network context
resolved this. No functionality was substituted to bypass these failures.

An intermediate preset install warned about an unapproved `unrs-resolver` postinstall;
that dependency was removed with the preset. No blanket install-script approval was used.

Not performed: clean `npm ci` reinstall, browser visual/responsive/accessibility checks,
cross-browser testing, load testing, authentication/RLS/integration security tests,
deployment or production verification. CSS contains mobile layout rules, but visual
behavior has not been verified in a browser. Unit tests are not evidence of access control.

## Exact direct dependencies

| Package                         | Version | Purpose                                                  |
| ------------------------------- | ------- | -------------------------------------------------------- |
| next                            | 16.4.3  | App Router and application builds                        |
| react / react-dom               | 19.3.1  | UI and DOM rendering                                     |
| typescript                      | 5.9.3   | Strict static checking within parser compatibility range |
| @types/node                     | 24.19.2 | Node declarations                                        |
| @types/react / @types/react-dom | 19.3.0  | React declarations                                       |
| eslint                          | 10.13.0 | Lint runner                                              |
| typescript-eslint               | 8.72.0  | TypeScript parser and lint rules                         |
| @next/eslint-plugin-next        | 16.4.3  | Official Next rules including core web vitals            |
| prettier                        | 3.9.10  | Formatting                                               |
| vitest                          | 5.0.5   | Unit test runner                                         |

All direct versions are pinned; package-lock.json captures transitives. No runtime
external service is contacted by the page. Development dependencies require registry
access when not cached. See DECISIONS for the lint-preset compatibility tradeoff.

## Handoff / limitations

Auth and data directories contain documentation only. Supabase Auth, PostgreSQL, RLS,
role enforcement, account provisioning, activities, targeting, submissions, verification,
announcements, history, scheduling generation and monitoring are **not implemented**.
No production-readiness claim. Do not load personal data or expose academic workflows
until the secure boundaries and adversarial access-control tests are in place.

Core rule policy is provisional: publication-time target snapshots, deadline-exclusive
windows and optional verification accounting. Obtain decisions listed in DECISIONS.
Pure helpers are not runtime input validators for future HTTP/database records.

## Recommended Milestone 2 (not started)

Approve role/scope and provisioning policy, then implement local Supabase Auth and
PostgreSQL identity/membership/responsibility schema with migrations, server-verified
sessions, deny-by-default RLS and cross-user/scope integration tests. Confirm free-tier
constraints and recovery requirements before any hosted provisioning. Only then add
the first end-to-end activity workflow in an explicitly agreed scope.

## Git summary

New repository with 25 authored/configuration/documentation/lock files, all untracked
pending user review. `git diff --stat` is empty because there is no commit/index baseline;
this does not mean there are no changes. Generated build output, dependencies and
TypeScript-generated files are ignored. No tracked generated files or secrets.
