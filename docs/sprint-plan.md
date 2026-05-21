# Sprint Plan

This document tracks the interaction/stack/priority sprint and the next safe upgrades.

## Current Status

- Step 1: Interaction Windows v1 - Done
- Step 1.5: Harden Interaction Windows v1 - Done
- Step 2: Stack Objects v1 - Done
- Step 2.5: Harden Stack Objects v1 - Done
- Step 3: Priority Passes v1 - Done
- Step 3.5: Harden Priority Passes v1 - Done
- Step 3.6: Agent harness docs - Done
- Step 4: Nested Responses / Counterplay v1 - Implemented
- Step 4.5: Harden Nested Responses / Counterplay v1 - Done
- Step 5: Activated / Triggered Interaction Windows v1 - Implemented
- Step 5.5: Harden Activated / Triggered Interaction Windows v1 - Done
- Step 6: Opponent-Cast Triggered Interaction Window v1 - Implemented
- Step 6.5: Harden Rhystic-style Opponent-Cast Triggered Windows - Done
- Step 7: Mystic Remora-style Opponent Noncreature Cast Triggered Window - Implemented
- Step 7.5: Harden Mystic Remora-style Triggered Windows - Done
- Step 8: Esper Sentinel-style Opponent Noncreature Cast Triggered Window - Implemented

## Step 4 Status

One-deep nested response/counterplay is implemented without building a full MTG stack.

Current scope:

- One response object atop the original object; no response-to-response.
- Counterspell wars like A casts spell, B counters, A counters back.
- Protection responding to removal or board wipes.
- Debug history for parent/child response objects.
- Deterministic tests for one-deep counterplay.

Out of scope for Step 4:

- Full three-or-more-deep stack.
- Full priority loops.
- Full comprehensive MTG priority.
- Full LIFO multi-object rules engine.
- Complete Oracle timing rules.

## Step 5.5 Status

The narrow activated/triggered window wiring has integration coverage for real TurnEngine draw-step Smothering Tithe-style triggers and real upkeep-gated Basalt Monolith / Rings untap windows. The docs now call out that unsupported triggers and upkeep payments may still resolve through direct heuristics.

## Step 6 Status

Opponent-cast triggered wiring is implemented for a single Rhystic Study-style path. `TurnEngine.castAction` notifies `TriggeredAbilityEngine.afterOpponentCast` after a successful cast, and high-impact Rhystic Study triggers can now use the existing interaction window, stack object, priority pass, and one-deep counterplay flow.

## Step 6.5 Status

Rhystic-style opponent-cast trigger behavior is hardened with regression coverage for stopped original spells, tutor spell casts, and multiple Rhystic-style controllers. The docs now call out that commander casts are not wired into this hook yet and exact tax payment rules remain future work.

## Step 7 Status

Mystic Remora-style opponent-cast trigger behavior is implemented through the existing `TurnEngine.castAction` -> `TriggeredAbilityEngine.afterOpponentCast` hook. The path opens triggered windows for opponent noncreature spell casts, draws one card if the window resolves, skips the draw if stopped, and keeps exact tax payment plus cumulative upkeep out of scope.

## Step 7.5 Status

Mystic Remora-style trigger behavior is hardened with coexistence coverage for Rhystic + Mystic sources, conservative no-type classification, and low-mana-value noncreature casts that trigger Mystic without triggering Rhystic. Commander casts remain a documented future hook.

## Step 8 Status

Esper Sentinel-style opponent-cast trigger behavior is implemented through the existing `TurnEngine.castAction` -> `TriggeredAbilityEngine.afterOpponentCast` hook. The path opens triggered windows for a caster's first qualifying opponent noncreature spell in the current simulator turn key, draws one card if the window resolves, skips the draw if stopped, and keeps exact power-based payment/tax logic out of scope.

## Next Target

Broaden activated/triggered coverage carefully, one production path at a time.

## Future Steps

- Better production wiring for activated and triggered windows.
- Richer protection and replacement-style effects.
- More exact combat and blocker modeling.
- More exact card behaviors for common Commander staples.
- Broader report support for stack/priority metrics.
