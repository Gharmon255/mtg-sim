# Tech Debt

Known issues and cleanup targets for future agents.

## Interaction / Stack / Priority

- Protection/counterplay timing is heuristic; board wipe defense may appear as counterplay against a response object rather than exact MTG timing.
- Table order is deterministic but not skill/readiness order; this is intentional for Priority Passes v1 but may need richer policy later.
- `stackObjectsProcessed` and `stackObjectsResolved` are internal/player metrics and still need future `ReportGenerator` surfacing if users need them in reports.
- Some direct `StackManager` tests exist for guard behavior only; behavior assertions should prefer production `InteractionEngine.attemptToStop` paths.
- Activated and triggered production windows are limited even though the model supports their window types.
- Board wipe and combo priority integration tests exist; they should continue expanding with realistic game-state fixtures.
- Nested Responses / Counterplay v1 has one-deep counterspell/protection coverage, but no 3+ deep counter wars or repeated priority loops.

## Combat

- Combat is not exact creature/blocker combat.
- Lethal combat interaction is a broad heuristic abstraction.
- Commander damage is simplified.

## Card Behavior

- Most cards still use generic tags/roles instead of exact behavior modules.
- Tutor and protection timing can still be too broad.
- More real precon and Moxfield-imported deck fixtures would improve regression confidence.

## Mana

- Source-level mana exists, but conditional/alternate costs and many replacement effects are simplified.
- Some utility lands and activated abilities are heuristic.
- Treasure generation is only modeled for supported behaviors/patterns.

## Data

- Missing Scryfall data lowers analyzer confidence.
- Placeholder cards can still make imported decks look weaker or less synergistic than they are.
- Local JSON cache may eventually need SQLite or a bulk-data refresh workflow.
