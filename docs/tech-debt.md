# Tech Debt

Known issues and cleanup targets for future agents.

## Interaction / Stack / Priority

- Protection/counterplay timing is heuristic; board wipe defense may appear as counterplay against a response object rather than exact MTG timing.
- Table order is deterministic but not skill/readiness order; this is intentional for Priority Passes v1 but may need richer policy later.
- `ReportGenerator` now surfaces compact stack/window totals, but richer per-window stack history and priority-response drilldowns remain debug/history-only.
- Some direct `StackManager` tests exist for guard behavior only; behavior assertions should prefer production `InteractionEngine.attemptToStop` paths.
- Activated and triggered production windows are limited to selected paths; TurnEngine draw-step Smothering Tithe-style draw-tax triggers, TurnEngine normal-spell and commander-cast Rhystic Study / Mystic Remora / Esper Sentinel-style triggers, and UpkeepEngine/AbilityResolver high-impact Monolith untap activations have coverage, but most abilities still bypass stack timing.
- Some trigger and upkeep paths intentionally resolve without a stack window when no interaction engine/context is present or when the current gating does not consider the ability interaction-relevant.
- Rhystic Study, Mystic Remora, and Esper Sentinel-style opponent-cast triggers do not model exact tax payment rules; Esper Sentinel does not use exact power-based payment logic, and Mystic Remora cumulative upkeep is not modeled by this trigger path.
- Commander casts now route through the Rhystic Study / Mystic Remora / Esper Sentinel-style opponent-cast trigger hook after successful `tryCastCommander` resolution, but commander timing is still heuristic and exact commander-related rules remain incomplete.
- Low-mana-value Mystic/Esper-vs-Rhystic gating, Esper first-spell gating, and ambiguous no-type conservative gating have regression coverage; richer real-card fixtures should keep expanding this area.
- Multiplayer Rhystic Study-style triggers have sequential multi-controller coverage, but broader multiplayer trigger policy still needs more real-game fixtures.
- ReportGenerator surfaces stack/priority/Rhystic/Mystic/Esper summary metrics, but detailed stack history is intentionally not printed in normal reports yet.
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
