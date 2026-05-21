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

Activated and triggered windows exist in the model, but production simulation does not broadly open them yet.

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

`stackObjectsProcessed` counts stack-like objects moved through `resolvePending`, including original objects and response objects. `stackObjectsResolved` means the object was valid and not stopped. These are currently internal/player metrics and are not broadly surfaced in `ReportGenerator` output yet.

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

## Remaining Limits

Still out of scope: full 3+ deep stack, repeated priority loops, comprehensive MTG timing, full activated/triggered production coverage, and exact Oracle-level stack behavior.
