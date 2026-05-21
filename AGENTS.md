# Agent Guide

Short guide for Codex, Cursor, and other AI agents working in this repo.

## What This Project Is

- A plain JavaScript MTG Commander simulator.
- A behavior-driven heuristic engine for deck import, validation, analysis, power estimation, strategy-aware simulation, and reports.
- A gradually improving Commander sandbox with local card data, Scryfall hydration, card tags, role metadata, card behaviors, source-level mana, interaction windows, stack objects, and priority passes.

## What This Project Is Not

- Not a full Magic rules engine.
- Not a complete Oracle text interpreter.
- Not a perfect Commander bracket or win-rate oracle.
- Not a full MTG stack/priority implementation yet.

## Required Commands Before Committing

Run the relevant focused command first, then the full preserved suite when behavior or engine code changes:

```bash
npm run test:interaction
npm run test:behaviors
npm run test:mana
npm run test:mana:sources
npm run test:abilities
npm run test:strategies
npm test
npm run build
```

For docs-only changes, `npm run build` is enough unless the documentation describes behavior that tests should verify.

## Supporting Docs

- [Architecture](ARCHITECTURE.md)
- [Sprint Plan](docs/sprint-plan.md)
- [Testing Guide](docs/testing-guide.md)
- [Simulator Limits](docs/simulator-limits.md)
- [Interaction System](docs/interaction-system.md)
- [Tech Debt](docs/tech-debt.md)
- [README](README.md)

## Guardrails

- Do not claim full MTG rules accuracy.
- Do not rewrite `TurnEngine`, `CombatEngine`, `GameEngine`, or `CardBehaviorEngine` wholesale without explicit task scope.
- Preserve existing CLI, API, and npm scripts.
- Add deterministic tests for behavior changes.
- Update README/docs when simulator fidelity changes.
- Keep the behavior-driven architecture unless a task explicitly changes it.
- Prefer small commits with clear summaries of files changed.
- Keep changes scoped to the requested step.
- Do not convert the project to TypeScript.
- Do not require paid APIs or a database server.

