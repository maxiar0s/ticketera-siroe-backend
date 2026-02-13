# AGENTS Guide - ss-ticketera-back

This guide is for coding agents working in this repository.
It documents the real commands and conventions used by the codebase.

## Project Snapshot

- Runtime: Node.js (Dockerfiles use Node 18 Alpine).
- Module system: ESM (`"type": "module"` in `package.json`).
- Main API entrypoint: `api/index.js`.
- Stack: Express + Sequelize + MySQL + JWT + Multer + Swagger.
- Domain language is mostly Spanish (models, routes, fields, and statuses).

## Source Layout

- `api/`: server bootstrap and middleware registration.
- `routes/`: route declarations and middleware chaining.
- `controllers/`: domain controllers (newer refactored modules).
- `controller/`: legacy controller area still imported in some places.
- `models/`: Sequelize models and associations.
- `middleware/`: auth guards, upload handlers, request logging.
- `services/`: cron and email processing services.
- `utils/`: parser, builder, validator, and logger helpers.
- `scripts/` and root `*.cjs`/`*.js`: operational scripts and DB checks.

## Build, Lint, Test, and Run Commands

### Install

- `npm install`

### Run API

- `npm run start` -> start API with Node.
- `npm run server` -> start API with nodemon (dev workflow).

### Build

- There is currently **no dedicated build script** (`npm run build` is not defined).
- This is a plain Node backend; runtime validation is done by starting the app.

### Lint / Format

- There is currently **no lint script** and no ESLint/Prettier config in repo.
- Do not introduce new tooling/config unless explicitly requested.
- Keep formatting consistent with the file you touch.

### Test

- There is currently **no automated test runner** (`npm test` is not defined).
- Existing validation is script-based and DB-oriented.

Useful checks:

- `node test-db.cjs` -> verify DB connection and basic query.
- `node test-queries.cjs` -> run diagnostic SQL queries.
- `node check-tables.cjs` -> verify schema/table availability.

### Run a Single Test (Current Equivalent)

Because there is no test framework, "single test" means running one script file:

- `node test-db.cjs`
- `node test-queries.cjs`
- `node check-tables.cjs`
- `node <path-to-custom-script>.cjs`

If a proper test framework is added later, update this section with exact single-test syntax.

## Data/Seed and Operational Commands

- `npm run db:importar` -> run standard seeder import.
- `npm run db:eliminar` -> remove seeded data.
- `npm run db:importar-demo` -> reset/import demo dataset.
- `npm run departamentos:sync` -> sync equipment departments.
- `npm run db:servicios-arriendo` -> apply equipment rental service script.
- `npm run db:proyectos` -> apply project module script.
- `npm run tickets:email` -> process inbound ticket email once.
- `npm run tickets:cron` -> run email ticket cron worker.

## Docker Commands

- `docker compose up --build` -> run local MySQL + backend.
- `docker compose run --rm seeder` -> run seed-if-needed flow.
- `docker compose --profile cron up --build` -> include cron container.

## Coding Conventions

### Language and Naming

- Keep domain vocabulary in Spanish where already established.
- Controllers and helper functions use `camelCase` (`getTickets`, `crearProyecto`).
- Sequelize model exports are `PascalCaseModel` aliases from `models/index.js`.
- DB enum/status strings are case-sensitive (for example `"Nuevo"`, `"Ingresado"`).

### Imports and Modules

- Use ESM imports/exports only (`import ... from`, `export const`, `export default`).
- Group imports with external packages first, then internal modules.
- For models, prefer importing from `../models/index.js` over direct model files.
- Keep one import per line unless local file style already groups them.

### Formatting and File Style

- Follow the style of the file being edited (repo has legacy mixed formatting).
- In refactored controller files, common style is 2 spaces, double quotes, semicolons, and trailing commas in multiline literals.
- Do not reformat large unrelated blocks while making functional changes.

### Types and Data Handling (JavaScript)

- Validate and normalize request input explicitly.
- Reuse existing patterns: `Number(...)`, `Number.isNaN(...)`, `Number.isInteger(...)`, parser helpers (`utils/parsers.js`), and validator helpers (`utils/validators.js`).
- For serialized JSON fields in models, guard `JSON.parse` with `try/catch` and safe fallbacks.

### Controller Patterns

- Wrap async controller logic in `try/catch`.
- Return early for validation/auth errors (`return res.status(...).json(...)`).
- Keep response shape consistent in touched area (`error` or `mensaje`, following local file style).
- Keep pagination and filter logic close to query construction.

### Error Handling and Logging

- Use explicit status codes: `400` invalid input, `401/403` auth/permissions, `404` missing resources, `500` unexpected errors.
- Preserve server-side logs with `console.error` and/or `registrarLog`.
- Do not leak secrets, tokens, or passwords in logs or API responses.

### Sequelize and DB Conventions

- Define associations in `models/index.js`; keep aliases (`as`) stable.
- Preserve existing table names and naming strategy (many are explicit/pluralized).
- Reuse model scopes that already exist (for example `scope("eliminarCampos")`).
- Use transactions when mutating multiple related rows.
- Respect existing `onDelete` behavior in associations.

### Routes and Middleware

- Keep route registration centralized in `routes/apiRoutes.js` and `routes/usuarioRoutes.js`.
- Preserve middleware order: auth -> upload processing -> controller.
- Use role guards consistently (`protegerRuta`, `protegerRutaAdmin`, `protegerRutaTecnico`, etc.).

### Security and Configuration

- Required env vars include DB settings and JWT secret (`JWT_SECRETPASSWORD`).
- Email and GCS integrations depend on additional env vars in `config/` and `services/`.
- Biblioteca -> RAG sync webhook env vars:
  - `RAG_SYNC_ENABLED` (default `true`)
  - `RAG_SYNC_WEBHOOK_URL` (ej: `http://rag-ticketera-ai:8000/kb/sync`)
  - `RAG_SYNC_WEBHOOK_SECRET` (debe coincidir con `RAG_SYNC_WEBHOOK_SECRET` del microservicio RAG)
  - `RAG_SYNC_TIMEOUT_MS` (default `5000`)
- Never commit secrets from `.env`, credential files, or private keys.

## Agent Workflow Expectations

- Inspect nearby code for local patterns before editing.
- Make narrowly scoped changes; avoid broad drive-by refactors.
- If you add commands or scripts, update this AGENTS.md.
- If you introduce linting or a test framework, document exact usage (including single-test command).

## Cursor/Copilot Rules

- Checked for Cursor rules in `.cursor/rules/` and `.cursorrules`: **not present**.
- Checked for Copilot rules in `.github/copilot-instructions.md`: **not present**.
- If those files are added later, update this guide to include them.

### Skills Registry

Auto-generated from `./.agents/skills` (repo) and `~/.agents/skills` (global).

| Skill | Source | Description |
|-------|--------|-------------|
| `agents-gemini-sync` | global | Sync `AGENTS.md` and `GEMINI.md` skill registry sections from both repository-local skills (`./.agents/skills`) and global skills (`~/.agents/skills`). Use when creating, renaming, deleting, or updating skills and you need agent docs to reflect current available skills. |
| `error-handling-patterns` | global | Master error handling patterns across languages including exceptions, Result types, error propagation, and graceful degradation to build resilient applications. Use when implementing error handling, designing APIs, or improving application reliability. |
| `find-skills` | global | Helps users discover and install agent skills when they ask questions like "how do I do X", "find a skill for X", "is there a skill that can...", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill. |
| `frontend-design` | global | Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics. |
| `nodejs-backend-patterns` | repo | Build production-ready Node.js backend services with Express/Fastify, implementing middleware patterns, error handling, authentication, database integration, and API design best practices. Use when creating Node.js servers, REST APIs, GraphQL backends, or microservices architectures. |
| `php-pro` | global | Use when building PHP applications with modern PHP 8.3+ features, Laravel, or Symfony frameworks. Invoke for strict typing, PHPStan level 9, async patterns with Swoole, PSR standards. |
| `skill-creator` | global | Guide for creating effective skills. This skill should be used when users want to create a new skill (or update an existing skill) that extends Claude's capabilities with specialized knowledge, workflows, or tool integrations. |
| `skill-sync` | global | Syncs skill metadata to AGENTS.md Auto-invoke sections. Trigger: When updating skill metadata (metadata.scope/metadata.auto_invoke), regenerating Auto-invoke tables, or running ./skills/skill-sync/assets/sync.sh (including --dry-run/--scope). |
