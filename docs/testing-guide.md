# Testing Guide

Use focused tests while developing, then run the preserved suite before handing off engine behavior changes.

## Commands

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

## When Each Test Matters

- `npm run test:interaction`: interaction windows, stack objects, priority passes, combat/lethal windows, board wipe windows, combo attempt windows, and debug/history metadata.
- `npm run test:behaviors`: exact card behavior priorities and card-specific sequencing.
- `npm run test:mana`: colored mana requirements, fixing, fetch/shock heuristics, and mana quality basics.
- `npm run test:mana:sources`: source-level mana activation, tapping, treasures, one-shot mana, dorks, and double-spend prevention.
- `npm run test:abilities`: activated abilities, upkeep/drawbacks, mox restrictions, fetch/channel lands, and treasure triggers.
- `npm run test:strategies`: loose archetype behavior regressions for combo, control, aggro, ramp, voltron, tokens, aristocrats, reanimator, stax, and midrange.
- `npm test`: import, validation, analyze, two-player simulation, and four-player simulation smoke coverage.
- `npm run build`: frontend/server build sanity.

## Expectations

- Add deterministic tests for simulator behavior changes.
- Use broad/relative assertions for heuristic AI behavior.
- Avoid brittle tests tied to exact random game outcomes unless a seed or tiny fixture makes the result stable.
- Prefer real `GameState` and production stack paths for interaction-system tests.
- For docs-only changes, `npm run build` is usually sufficient.

