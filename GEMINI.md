# GEMINI Guide - ss-ticketera-back

This guide is for Gemini-style coding agents working in this repository.
It complements `AGENTS.md` and focuses on stable operational context.

## Project Snapshot

- Runtime: Node.js (Dockerfiles use Node 18 Alpine).
- Module system: ESM (`"type": "module"` in `package.json`).
- Main API entrypoint: `api/index.js`.
- Stack: Express + Sequelize + MySQL + JWT + Multer + Swagger.
- Domain language is primarily Spanish.

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

## Build, Lint, and Test Commands

- Install dependencies: `npm install`
- Run API: `npm run start`
- Dev server: `npm run server`
- DB checks: `node test-db.cjs`, `node test-queries.cjs`, `node check-tables.cjs`

## Notes

- Keep changes narrowly scoped and consistent with existing code style.
- Prefer existing patterns for controllers, middleware order, and Sequelize usage.
- Do not commit secrets from `.env` or credential files.
