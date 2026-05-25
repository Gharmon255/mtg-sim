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
- Step 9: Commander-Cast Routing Through Opponent-Cast Trigger Hook - Implemented
- Step 10: Heuristic Pay-Or-Draw For Rhystic/Mystic/Esper-style Tax Triggers - Implemented
- Step 10.5: Harden Heuristic Tax Metrics And Commander-Tax Estimates - Done
- Step 11: Smothering Tithe-style Heuristic Pay-Or-Treasure On Opponent Draw - Implemented

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

At Step 6, the first opponent-cast triggered wiring was implemented for the Rhystic Study-style path. `TurnEngine.castAction` notifies `TriggeredAbilityEngine.afterOpponentCast` after a successful cast, and high-impact Rhystic Study triggers can now use the existing interaction window, stack object, priority pass, and one-deep counterplay flow.

## Step 6.5 Status

Rhystic-style opponent-cast trigger behavior is hardened with regression coverage for stopped original spells, tutor spell casts, and multiple Rhystic-style controllers. Exact tax payment rules remained future work at this step.

## Step 7 Status

Mystic Remora-style opponent-cast trigger behavior is implemented through the existing `TurnEngine.castAction` -> `TriggeredAbilityEngine.afterOpponentCast` hook. The path opens triggered windows for opponent noncreature spell casts, draws one card if the window resolves, skips the draw if stopped, and keeps exact tax payment plus cumulative upkeep out of scope.

## Step 7.5 Status

Mystic Remora-style trigger behavior is hardened with coexistence coverage for Rhystic + Mystic sources, conservative no-type classification, and low-mana-value noncreature casts that trigger Mystic without triggering Rhystic. Commander casts were still a documented future hook at this step.

## Step 8 Status

Esper Sentinel-style opponent-cast trigger behavior is implemented through the existing `TurnEngine.castAction` -> `TriggeredAbilityEngine.afterOpponentCast` hook. The path opens triggered windows for a caster's first qualifying opponent noncreature spell in the current simulator turn key, draws one card if the window resolves, skips the draw if stopped, and keeps exact power-based payment/tax logic out of scope.

Current opponent-cast production coverage is limited to Rhystic Study-style, Mystic Remora-style, and Esper Sentinel-style heuristic draw-tax paths. Exact tax/payment modeling remains future work.

## Step 9 Status

Successful commander casts now call the same `TriggeredAbilityEngine.afterOpponentCast` hook used by normal spell casts. Rhystic Study-style triggers can see commander casts that pass the existing impact gate, while Mystic Remora-style and Esper Sentinel-style triggers still use their current noncreature gates. Failed or skipped commander casts do not open opponent-cast trigger windows. Commander timing and all tax/payment rules remain heuristic.

## Step 10 Status

Rhystic Study-style, Mystic Remora-style, and Esper Sentinel-style triggers now run a deterministic heuristic pay-or-draw decision after their interaction window resolves and is not stopped. Paid taxes skip the draw; unpaid heuristic outcomes keep the existing draw benefit. The payment itself does not open another stack or priority window, and exact tax timing/payment rules remain out of scope.

## Step 10.5 Status

Tax metrics now document that "declined" means unpaid by the simulator heuristic, including cannot-pay and reserve-based cases. Commander-cast tax estimates account for the current commander tax when deciding whether the caster can spare mana for Rhystic-style payments, and Esper Sentinel-style tests cover power greater than one. Report text uses "paid/unpaid" wording while preserving the existing internal metric names.

## Step 11 Status

Smothering Tithe-style opponent draw triggers now run a deterministic heuristic pay-or-treasure decision after their interaction window resolves and is not stopped. Paid taxes skip Treasure creation; unpaid heuristic outcomes create Treasure through the existing TokenManager path. The payment itself does not open another stack or priority window, and exact MTG payment timing remains out of scope.

## Next Target

Broaden activated/triggered coverage carefully, one production path at a time.

## Future Steps

- Better production wiring for activated and triggered windows.
- Richer protection and replacement-style effects.
- More exact combat and blocker modeling.
- More exact card behaviors for common Commander staples.
- Broader report support for stack/priority metrics.
