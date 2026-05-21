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

## Step 4 Status

One-deep nested response/counterplay is implemented without building a full MTG stack.

Current scope:

- One response to a response.
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

## Next Target

Expand production wiring for activated and triggered windows after more real-game fixture review.

## Future Steps

- Better production wiring for activated and triggered windows.
- Richer protection and replacement-style effects.
- More exact combat and blocker modeling.
- More exact card behaviors for common Commander staples.
- Broader report support for stack/priority metrics.
