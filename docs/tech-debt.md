# Tech Debt

Known issues and cleanup targets for future agents.

## Interaction / Stack / Priority

- Protection/counterplay timing is heuristic; board wipe defense may appear as counterplay against a response object rather than exact MTG timing.
- Table order is deterministic but not skill/readiness order; this is intentional for Priority Passes v1 but may need richer policy later.
- `stackObjectsProcessed` and `stackObjectsResolved` are internal/player metrics and still need future `ReportGenerator` surfacing if users need them in reports.
- Some direct `StackManager` tests exist for guard behavior only; behavior assertions should prefer production `InteractionEngine.attemptToStop` paths.
- Activated and triggered production windows are limited to selected paths; TurnEngine draw-step Smothering Tithe-style draw-tax triggers, TurnEngine opponent-cast Rhystic Study-style triggers, and UpkeepEngine/AbilityResolver high-impact Monolith untap activations have coverage, but most abilities still bypass stack timing.
- Some trigger and upkeep paths intentionally resolve without a stack window when no interaction engine/context is present or when the current gating does not consider the ability interaction-relevant.
- Rhystic Study-style opponent-cast triggers do not model exact tax payment rules and do not cover every Mystic Remora / Esper Sentinel-style trigger yet.
- Commander casts are not wired into Rhystic Study-style opponent-cast trigger windows yet because `tryCastCommander` does not currently call the successful-cast hook.
- Multiplayer Rhystic Study-style triggers have sequential multi-controller coverage, but broader multiplayer trigger policy still needs more real-game fixtures.
- ReportGenerator still does not surface stack/priority/Rhystic trigger metrics in a user-facing way.
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
