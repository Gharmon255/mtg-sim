# Architecture

This project is a backend-first, plain JavaScript Commander simulator with a small React frontend. It is intentionally modular so rules fidelity can improve over time without turning one file into a full rules engine.

## Entry Points

- CLI: `src/cli/index.js` and `src/cli/commands/*`
- Server/API: `src/server/index.js`
- Frontend: `frontend/*`
- Build: Vite via `npm run build`

## Simulation Flow

1. Import decklists with deck importers.
2. Load/hydrate card data from local JSON and Scryfall cache.
3. Validate Commander legality at the current supported fidelity.
4. Analyze deck power, combos, archetype, strategy profile, mana, tags, and roles.
5. Initialize players and game state.
6. Run turn loops with mulligans, land sequencing, casting, combo attempts, interaction windows, combat, cleanup, and reports.
7. Aggregate simulation results into readable CLI/API/frontend reports.

## Main Layers

- Decks: `src/decks/*`
- Importers: `src/importers/*`
- Cards/data: `src/cards/*`, `data/*.json`
- Analysis: `src/analysis/*`
- AI strategy: `src/ai/*`
- Game engine: `src/game/*`
- Rules helpers: `src/rules/*`
- Simulation/reporting: `src/simulation/*`
- Server/frontend: `src/server/*`, `frontend/*`

## Game State Models

- `GameState` owns players, turn count, events, debug output, and the stack manager.
- `PlayerState` owns deck zones, hand, library, battlefield, graveyard, command zone, life, mana, metrics, and per-game state.
- `PermanentState` tracks battlefield permanents, tapped state, summoning sickness, counters, tokens, sacrificed/exhausted state, and attached metadata.

## Turn And Combat

- `TurnEngine` coordinates turn flow, draw, land play, casting priorities, combo attempts, combat, and cleanup.
- `CombatEngine` applies simplified combat based on board score and commander damage pressure.
- Combat is abstract. It does not model exact attackers, blockers, damage assignment, or combat timing yet.

## Card Behavior System

- `CardBehaviorEngine` and behavior registries prefer exact card behavior when available.
- Card roles in `data/card-roles.json` guide sequencing, tutor targets, interaction timing, and archetype-specific priorities.
- Tags and generic behaviors are fallback layers when exact card behavior is missing.

## Interaction System

- `InteractionEngine` coordinates simplified counterplay.
- `InteractionWindow` describes an important action such as a spell, board wipe, combo attempt, or lethal combat.
- `StackObject` wraps the window for stack-like debug/history.
- `PriorityManager` runs deterministic Priority Passes v1.
- Nested Responses / Counterplay v1 allows exactly one response object on top of the original object, with one counterplay opportunity from the original controller.
- Activated / Triggered Interaction Windows v1 wires selected production paths, currently Smothering Tithe-style draw triggers and high-impact Monolith untap activations.
- `StackManager` resolves one pending object and records history.

Current flow:

```text
interaction window -> original stack object -> priority pass -> optional one-deep response object -> resolve response -> resolve original -> history
```

This is not full MTG priority or stack behavior. There are no repeated priority loops, no 3+ deep counter wars, and most activated/triggered abilities still do not use stack timing.

## Mana System

- `ManaCostParser` parses costs.
- `ManaPayment` checks payments.
- `ManaSourceManager` selects and consumes individual mana sources.
- `PermanentState`, `ManaSource`, and `TokenManager` support tapped lands, rocks, dorks, treasures, one-shot mana, summoning sickness, and sacrifice/exhaustion.
- Mana is more detailed than early MVP scoring, but still not complete Oracle-level rules.

## Data And Hydration

- Starter data: `data/cards.starter.json`
- Cache: `data/cards.cache.json`
- Precon cache: `data/cards.precons.json`
- Power tags: `data/card-power-tags.json`
- Roles: `data/card-roles.json`
- Combos: `data/known-combos.json`
- Commander combo rules: `data/commander-combo-rules.json`
- Hydration uses Scryfall public fuzzy lookup with local caching and graceful failures.

## Testing Approach

- Tests are command-based and deterministic where practical.
- Behavior changes should add focused regression coverage.
- Interaction/stack/priority changes should use real `GameState` and production stack paths when possible.
- Full preserved suite is listed in [docs/testing-guide.md](docs/testing-guide.md).
