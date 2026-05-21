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

## Next Target

Broaden activated/triggered coverage carefully, one production path at a time.

## Future Steps

- Better production wiring for activated and triggered windows.
- Richer protection and replacement-style effects.
- More exact combat and blocker modeling.
- More exact card behaviors for common Commander staples.
- Broader report support for stack/priority metrics.
