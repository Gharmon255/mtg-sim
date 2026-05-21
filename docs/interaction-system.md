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
3. Stop the object if one valid response is chosen.
4. Resolve if everyone passes.

This is not full MTG priority. There are no nested responses, repeated priority loops, or true multi-object LIFO stack rules yet.

## Current Flow

```text
interaction window -> stack object -> priority pass -> resolve pending -> history
```

Debug output should show:

- stack object created
- stack object pushed
- priority pass begins
- priority order
- pass/response choices
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

## Step 4 Next

Nested Responses / Counterplay v1 should add one-deep response objects, such as:

- counterspell wars A -> B -> A
- protection responding to removal
- protection responding to board wipes
- debug/history links between original stack object and one nested response

Still out of scope: full 3+ deep stack, full priority, and comprehensive MTG timing.

