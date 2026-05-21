# Simulator Limits

This simulator is improving steadily, but it is not a full Magic rules engine.

## Rules And Timing

- Not a complete Oracle text interpreter.
- Not full MTG priority.
- Stack Objects are not the full MTG stack.
- Nested Responses / Counterplay v1 is capped at one response object.
- No repeated priority loops or 3+ deep stack/counter-war support yet.
- Triggered and activated window types exist, and a narrow Smothering Tithe-style trigger plus high-impact Monolith untap path are wired, but production simulation does not broadly open every ability yet.
- Replacement effects, layers, state-based actions, exact timing permissions, and many continuous effects are not fully modeled.

## Combat

- Combat is abstracted through board score and commander damage pressure.
- It does not model exact attackers, blockers, evasion, first strike, trample assignment, or combat tricks at full fidelity.
- Lethal combat can be stopped by the current heuristic interaction policy, which represents broad emergency counterplay and is not a claim about normal counterspells countering combat damage.

## Card Logic

- Behaviors drive most card logic.
- Exact behavior modules exist for important cards, but most cards still fall back to roles, tags, or generic behavior.
- Combo detection includes exact known combos and lower-confidence pattern warnings; it is not proof of every deterministic line.

## Mana

- Mana is source-level and color-aware, but still simplified.
- Conditional mana abilities, replacement effects, cost reducers, alternate costs, and timing restrictions are incomplete.
- Tokens and treasure behavior are limited to supported cards/patterns.

## Analysis

- Commander bracket estimates are heuristics.
- Confidence depends on hydrated card data and tags.
- Missing card data can produce false-low or noisy estimates.
- Reports should be treated as simulation signals, not authoritative gameplay truth.
