# Interaction System

The interaction system is a deterministic heuristic bridge toward fuller stack and priority modeling.

## Interaction Windows v1

`InteractionWindow` records an important action:

- source player
- source card
- action/window type
- target player or permanent when available
- impact or threat score
- whether it can be countered, removed, or protected
- reason/debug metadata

Current window types include:

- spell cast
- activated ability
- triggered ability
- combat/lethal
- combo attempt
- board wipe

Activated and triggered windows exist in the model. Production simulation now opens a narrow set of real triggered/activated paths, but it does not broadly open every ability yet. If no interaction engine/context is present, these abilities may still resolve through the older direct heuristic path without stack history.

## Stack Objects v1

`StackObject` wraps an interaction window with stack-like metadata:

- id
- controller/source player
- source card
- target
- action/window type
- impact/threat score
- resolved/stopped/result state
- priority metadata
- debug metadata

`StackManager` owns pending objects and history. V1 resolves one pending object at a time.

## Priority Passes v1

`PriorityManager` runs a deterministic heuristic pass layer:

1. Represent source/controller first.
2. Give opponents one response opportunity in current table order.
3. If one valid response is chosen, push a one-deep response object.
4. Give the original controller one counterplay opportunity.
5. Resolve the response object first, then the original object.
6. Resolve if everyone passes.

This is not full MTG priority. There are no repeated priority loops, unlimited nested responses, or true multi-object LIFO stack rules yet.

## Nested Responses / Counterplay v1

Step 4 adds exactly one nested response object:

```text
original object -> one response object -> optional one counterplay answer
```

When a response would stop an original object, `PriorityManager` must push a response `StackObject`; it should not hide the response only inside priority metadata. The response object links back to the parent with `respondsTo` / `parentStackObjectId`, resolves first, then the original object resolves or is stopped.

Supported examples:

- A casts a high-impact spell, B counters it, A counters back.
- A casts a board wipe, B counters it, A protects/counters back when current heuristics support that.
- A attempts a combo, B responds, A may use one legal counterplay answer.

Depth is intentionally capped at one response object. If B has another counterspell after A counters back, this v1 layer does not create a third object.

Step 4.5 adds a hard depth guard: if code tries to push a response object onto an existing response object, or onto any object with `responseDepth >= 1`, the push is refused with `nested_response_depth_limit`. The guard records debug output, does not consume the attempted answer, does not open another interaction window, and leaves stack history at the original object plus the allowed one response object.

Protection timing is also heuristic. For board wipes and other protected windows, the current model may represent defense as counterplay against a response object rather than the older immediate "protect before counter" path. This is a simulator abstraction for keeping important plans alive; it is not exact Magic timing.

## Metrics

`interactionWindowsOpened` counts real production windows opened for original important actions. Nested response objects are stack objects, but they do not increment `interactionWindowsOpened`.

`stackObjectsProcessed` counts stack-like objects moved through `resolvePending`, including original objects and response objects. `stackObjectsResolved` means the object was valid and not stopped.

Simulation reports now surface a compact Interaction / Stack Summary. `interactionWindowsOpened` counts opened windows, not guaranteed resolved effects. `stackObjectsProcessed` may include stopped, invalid, original, and response objects. `stackObjectsResolved` counts valid objects that were not stopped. The report's priority response count is currently derived from existing stack/window totals when no explicit priority-response metric is present, so it is a visibility signal rather than a full stack audit log. Rhystic Study-style, Mystic Remora-style, and Esper Sentinel-style draw counts are heuristic draw benefits, not exact tax/payment-rule outcomes.

## Current Flow

```text
interaction window -> original stack object -> priority pass -> optional response stack object -> resolve response -> resolve original -> history
```

Debug output should show:

- stack object created
- stack object pushed
- priority pass begins
- priority order
- pass/response choices
- priority response chosen
- nested response object pushed, when applicable
- counterplay opportunity, pass, or answer
- priority pass complete
- stack object resolving
- stopped or resolved
- moved to history

## Current Production Paths

Production simulation opens explicit windows mainly for:

- spell/high-impact casts
- board wipes
- combat/lethal attacks
- combo attempts
- selected triggered abilities, currently Smothering Tithe-style draw-tax treasure triggers
- selected opponent-cast triggered abilities, currently Rhystic Study-style, Mystic Remora-style, and Esper Sentinel-style draw triggers
- selected activated abilities, currently high-impact Monolith untap/combo-engine activations

## Activated / Triggered Wiring v1

Step 5 adds narrow production wiring for:

- `TurnEngine` draw-step production into `TriggeredAbilityEngine` Smothering Tithe-style opponent draw triggers. If the trigger is stopped, the Treasure effect is skipped; if no one responds, the draw still happened and Treasures are created.
- `UpkeepEngine` / `AbilityResolver` production into high-impact Monolith untap activations when they look combo-relevant. If the activation is stopped, costs are not paid and the ability effect is skipped.

Smothering Tithe-style triggered windows currently open only when the production path provides enough interaction context:

- The trigger is running through a production path with an `InteractionEngine` available.
- The trigger is considered interaction-relevant or high enough impact by current narrow gating.
- The draw/trigger context can identify the source player, target/opponent, source card, and reason/debug text.
- Otherwise, the trigger may resolve through the legacy heuristic path without opening a stack window.

This is intentional Step 5 narrow wiring. Not every draw-tax trigger opens a stack window yet; future work can broaden trigger coverage one production path at a time.

## Opponent-Cast Triggered Wiring v1

Steps 6 through 10 add narrow opponent-cast triggered paths:

- `TurnEngine.castAction` notifies `TriggeredAbilityEngine.afterOpponentCast` after a spell has successfully resolved through the simulator's cast flow.
- `TurnEngine.tryCastCommander` also notifies `TriggeredAbilityEngine.afterOpponentCast` after a commander is successfully cast through the commander-cast path. Failed or skipped commander casts do not open opponent-cast trigger windows.
- `TriggeredAbilityEngine` currently checks for three narrow draw-tax-style paths controlled by opponents of the casting player: Rhystic Study-style opponent-cast triggers, Mystic Remora-style opponent noncreature-cast triggers, and Esper Sentinel-style opponent noncreature-cast triggers.
- Rhystic Study-style windows open only when the cast spell is interaction-relevant, such as a high-impact spell, win condition, stax piece, board wipe, combo-wincon, or a spell with mana value 4 or greater.
- The window records source player, source card, casting/target player, cast-card debug metadata, impact score, and a reason.
- If no one stops the trigger, the casting player may pay a deterministic heuristic tax. If paid, the draw is skipped; if not paid, the Rhystic controller may draw one card as the current heuristic benefit.
- If the trigger is stopped, the draw is skipped and stack/priority/history records the stopped trigger.
- If the original spell is stopped before the simulator reaches the successful-cast hook, the Rhystic-style trigger does not open and does not draw.
- Tutor spells that pass through the same successful `cast_tutor` hook may create Rhystic-style trigger windows when they meet the current gating rules.
- Commander casts that pass through the successful `tryCastCommander` hook may create Rhystic-style trigger windows when they meet the current Rhystic impact gate. Mystic Remora-style and Esper Sentinel-style triggers still use their current noncreature gates, so normal creature commanders usually do not trigger them.
- Multiple Rhystic-style controllers can create sequential trigger windows in current table order.
- `TriggeredAbilityEngine` also looks for `Mystic Remora` or a Mystic Remora-style tag-gated equivalent controlled by an opponent of the casting player.
- Mystic Remora-style windows open for opponent noncreature spells. Current noncreature classification treats explicit creature type lines or `creature` tags as creature casts; known noncreature type lines are accepted; missing type data is conservative unless action/tag metadata clearly says noncreature.
- If no one stops the Mystic Remora-style trigger, the casting player may pay a deterministic heuristic tax. If paid, the draw is skipped; if not paid, the controller may draw one card as the current heuristic benefit. If stopped, no tax payment is asked and that draw is skipped.
- `TriggeredAbilityEngine` also looks for `Esper Sentinel` or an Esper Sentinel-style tag-gated equivalent controlled by an opponent of the casting player.
- Esper Sentinel-style windows open for the first opponent noncreature spell that a caster casts during the current simulator turn key. The gate is stored per Esper permanent and per casting player so a second noncreature spell from the same caster in that turn does not open another Esper-style trigger.
- Esper Sentinel-style noncreature classification uses the same conservative helper as Mystic Remora-style triggers. Missing or ambiguous type data does not open a window unless action/tag metadata clearly says noncreature.
- If no one stops the Esper Sentinel-style trigger, the casting player may pay a deterministic heuristic tax. If paid, the draw is skipped; if not paid, the controller may draw one card as the current heuristic benefit. If stopped, no tax payment is asked and that draw is skipped.
- If a player controls Rhystic Study-style, Mystic Remora-style, and Esper Sentinel-style permanents, a high-impact noncreature spell can create one spell window plus one trigger window for each qualifying permanent. This is expected and should not double-count beyond one window per source trigger.
- Low-mana-value noncreature spells may open Mystic Remora-style windows even when the same cast does not open a Rhystic Study-style window, because Rhystic's current path is impact-gated while Mystic's path is noncreature-gated.
- Ambiguous casts with no type line and no clear action/tag metadata do not open Mystic Remora-style windows. This conservative fallback avoids treating unknown card data as a noncreature spell.

Step 10 adds heuristic pay-or-draw decisions after an eligible trigger survives interaction. Rhystic-style taxes use a heuristic pay-1 check, Mystic Remora-style taxes use a heuristic pay-4 check, and Esper Sentinel-style taxes use the permanent's power when available or a simplified pay-1 fallback. These payments do not create another stack or priority window.

Step 10.5 clarifies that internal `rhysticTaxesDeclined`, `mysticTaxesDeclined`, and `esperTaxesDeclined` counters mean "unpaid by heuristic." They can include deliberate nonpayment, insufficient post-cast mana, or a reserve-based decision to keep mana available. Commander-cast payment estimates include the current commander tax, and Esper Sentinel-style tests cover power above one when that power is available on the permanent.

This does not implement exact Rhystic Study, Mystic Remora, or Esper Sentinel tax payment rules yet. Opponents do not currently make full rules-accurate payment choices, and Esper Sentinel power/payment may still be simplified when exact power is not modeled. The simulator only models the interaction-window opportunity plus a deterministic post-resolution payment heuristic around the draw trigger. Mystic Remora cumulative upkeep is also out of scope for this path. Low-impact casts currently do not open an extra Rhystic stack window, and not every draw-tax-style trigger is wired. Future work should broaden this one production path at a time.

This does not mean every triggered or activated ability uses stack timing. Smothering Tithe/Rhystic/Mystic/Esper-style triggers may resolve without a stack window when no interaction engine/context is present or when the current narrow gating does not consider the trigger interaction-relevant. Likewise, some Grim Monolith / Mana Vault-style upkeep untap/payment paths may resolve without an interaction window by heuristic design. Steps 5 through 10 only prove selected production routes can use the same `InteractionWindow -> StackObject -> PriorityManager -> optional one-deep counterplay -> history` path.

## Remaining Limits

Still out of scope: full 3+ deep stack, repeated priority loops, comprehensive MTG timing, full activated/triggered production coverage, and exact Oracle-level stack behavior.
