# mtg-commander-simulator

A backend-first JavaScript MVP for simulating simplified Magic: The Gathering Commander pods. It imports decklists, validates basic Commander legality, uses a local starter card database, runs deterministic 2-4 player simulations, and prints readable performance reports.

This project is intentionally not a full MTG rules engine yet. The design separates deck parsing, validation, card data, card behavior, game state, turn flow, combat, simulation aggregation, and reports so exact card logic can be added gradually.

## Install

```bash
npm install
```

The project uses plain JavaScript. It does not use TypeScript or require a database server.

## Run The Website

Build the React app and start the local web server:

```bash
npm run build
npm start
```

Then open:

```text
http://127.0.0.1:3001
```

The website lets you choose a sample deck, add 1-3 opponents, validate, analyze, and run simulations.
It also includes a Latest Precons panel for importing the newest Commander precons into `decks/precons`.
Use the Import From Wizards panel to search official `magic.wizards.com` decklist articles or paste a Wizards article URL directly.
Use Import Pasted List for Manabox or Moxfield-style exported deck text.

For frontend development, use two terminals:

```bash
npm run api
npm run dev
```

Then open the Vite dev server:

```text
http://127.0.0.1:5173
```

## Run The CLI

```bash
npm run cli
npm run validate -- --deck ./decks/precons/secrets-of-strixhaven-lorehold-spirit.txt
npm run analyze -- --deck ./decks/precons/secrets-of-strixhaven-lorehold-spirit.txt
npm run bracket -- --deck ./decks/green-ramp.txt
npm run combos -- --deck ./decks/sample-combo.txt
npm run power -- --deck ./decks/sample-combo.txt
npm run hydrate -- --deck ./decks/sample-thoracle-combo.txt
npm run report -- --deck ./decks/sample-thoracle-combo.txt
npm run strategy -- --deck ./decks/sample-thoracle-combo.txt
npm run import:moxfield -- --input ./decks/moxfield-export-test.txt --output ./decks/imported/moxfield-export-test.txt
npm run import:moxfield -- --url https://www.moxfield.com/decks/DECK_ID
npm run test:strategies
npm run test:interaction
npm run report -- --deck ./decks/sample-casual.txt --opponents ./decks/sample-high-power.txt ./decks/sample-isochron-combo.txt
npm run simulate -- --deck ./decks/precons/secrets-of-strixhaven-lorehold-spirit.txt --opponents ./decks/precons/lorwyn-eclipsed-blight-curse.txt --games 100 --seed demo
npm run simulate -- --deck ./decks/precons/secrets-of-strixhaven-lorehold-spirit.txt --opponents ./decks/precons/lorwyn-eclipsed-blight-curse.txt ./decks/precons/teenage-mutant-ninja-turtles-turtle-power.txt ./decks/precons/secrets-of-strixhaven-lorehold-spirit.txt --games 100 --seed pod
npm run precons:import
npm run cli -- import-wizards --url https://magic.wizards.com/en/news/announcements/final-fantasy-commander-decklists --limit 1 --cardLimit 5
npm test
```

You can also run commands directly:

```bash
node src/cli/index.js simulate --deck ./decks/precons/secrets-of-strixhaven-lorehold-spirit.txt --opponents ./decks/precons/lorwyn-eclipsed-blight-curse.txt --games 10
```

## Deck Import Format

Simple format:

```text
1 Commander Name
1 Sol Ring
1 Arcane Signet
1 Card Name
```

Manabox-style sections:

```text
// COMMANDER
1 Leonardo, the Balance (TMC) 1

// DECK
1 Sol Ring (M3C) 305
```

If no commander section exists, the importer treats the first card line as the commander.

## Current Validation

The MVP checks:

- Commander exists.
- Deck has 100 cards including commander.
- Singleton rule, except basic lands.
- Card color identity fits commander color identity.
- Commander is a legendary creature or explicitly tagged as commander.
- Multiple commanders require a partner-like pairing ability.
- Cards on the local Commander banned list are illegal.
- Category bans are flagged for Conspiracy, ante, sticker, and Attraction cards when card text/type data is available.
- Known Commander legality flags when present in local card data.

Missing cards are warnings because the starter database is intentionally tiny.
The Commander banned list is stored in `data/commander-banned.json` and was checked against the official Wizards banned and restricted page on 2026-05-15.

## Card Data And Hydration

Starter cards live in `data/cards.starter.json`. Imported and hydrated cards are cached locally so repeat runs do not keep calling Scryfall.

Hydrate one deck:

```bash
npm run hydrate -- --deck ./decks/mydeck.txt
```

Hydrate a pod:

```bash
npm run hydrate -- --deck ./decks/deck1.txt --opponents ./decks/deck2.txt ./decks/deck3.txt
```

Hydration checks the local cache first, then uses Scryfall's public fuzzy lookup endpoint for missing cards. Results are stored in:

```text
data/cards.cache.json
```

Cached records include:

- `name`
- `manaCost`
- `manaValue`
- `colors`
- `colorIdentity`
- `typeLine`
- `oracleText`
- `power`
- `toughness`
- `legalities`
- `producedMana`
- `keywords`
- `scryfallId`
- `layout`
- `faces`
- `edhrecRank`
- `prices`
- `fetchedAt`
- `tags`

Network failures are handled as warnings. Failed lookups do not crash validation, reports, or simulation; they lower confidence instead.

## Simulation Assumptions

The engine models a simplified Commander game:

- Shuffle and draw opening hands.
- Use simple mulligan logic for low/high land hands.
- Draw one card per turn.
- Play one land per turn.
- Start at 40 life.
- Keep commanders in a command zone.
- Apply commander tax when casting from the command zone.
- Cast ramp, draw, interaction, threats, creatures, and commanders using tag-based priorities.
- Apply simplified combat damage from board score.
- Track simplified commander combat damage and eliminate players at 21 damage from the same commander.
- Track life totals, cards drawn, ramp, removal, commander cast turn, mana screw/flood, board score, threat score, and win/loss outcomes.
- Build an AI strategy profile for each deck from bracket, archetype, combo, mana, and tag analysis.
- Use strategy-aware mulligans, tutor choices, casting priorities, threat selection, combo attempts, and simplified interaction.
- Allow exact known combos and lower-confidence possible combo lines to win games when setup conditions are met.
- Let opponents use Interaction Windows v1, a simplified counterplay layer for combo wins, high-impact spells, board wipes, and lethal attacks.
- End when one player remains or the max turn limit is reached.

It does not yet model the stack accurately, full priority passes, nested responses, replacement effects, every triggered ability, every timing restriction, every combat rule, or exact Oracle text. Rules fidelity is intentionally incremental: validation should become strict before simulation becomes exact.

## Strategy Profiles

The simulator turns analyzer output into a deck AI profile before games start. Run:

```bash
npm run strategy -- --deck ./decks/sample-thoracle-combo.txt
```

Profiles include archetype, bracket, aggression, combo, control, ramp, commander, protection, tutor, removal, board wipe, stax priorities, threat bias, mulligan priorities, game plans, win plans, and analyzer warnings.

During simulation, profiles influence opening hand keeps, tutor targets, combat and removal targets, whether a deck holds interaction, when combo decks attempt wins, and whether opponents spend simplified counterplay to stop major plays.

Interaction Windows v1 sits between the heuristic `InteractionEngine` and a future full stack/priority system. Each window records a source player, source card, action type, target when known, impact score, whether it can be countered/removed/protected, the reason it matters, and debug metadata. The model supports spell-cast, activated ability, triggered ability, combat/lethal, combo attempt, and board wipe window types.

Current production simulation opens explicit windows mainly for spell casts that are high-impact, stax, win conditions, or board wipes; combat/lethal attacks; and combo attempts. Activated and triggered window types exist in the model for the next step, but they are not broadly opened by production simulation yet.

For simulator continuity, lethal combat windows remain counterable by default. This is a heuristic abstraction for emergency interaction such as bounce, fog-like effects, free answers, or other broad counterplay; it is not claiming a normal counterspell can counter combat damage under real Magic rules.

Stack Objects v1 is a thin simulator wrapper around Interaction Windows v1. `StackObject` and `StackManager` let the engine create one stack-like object, resolve it through the existing interaction logic, then move it to history for debug output and tests.

This is not the full MTG stack. The simulator does not yet pass priority around the table, allow nested responses, or perform full LIFO multi-object resolution beyond basic push/pop support. Stack Objects v1 is a deterministic bridge so debug output and tests can describe when an object is created, pushed, resolving, stopped or resolved, and moved to history.

## Card Roles And Sequencing

Broad tags still matter, but the simulator also has exact card role metadata for important Commander staples.

Manual role data lives in:

```text
data/card-roles.json
```

The role system is loaded by:

```text
src/cards/CardRoleRegistry.js
src/cards/CardRoleResolver.js
src/ai/CommanderPlanResolver.js
```

Role metadata tells the AI when a card is usually cast, which archetypes value it most, what a tutor should find, and when a card should be held for a clear purpose. This improves tutor targeting, counterspell thresholds, protection timing, removal quality, board wipe timing, and commander casting decisions.

Simulation reports now include a Sequencing Report with tutor efficiency, high-priority counters, wasted counters, protection quality, removal target quality, board wipe quality, commander sequencing, and a card-specific sequencing score.

This is still heuristic. It does not prove the exact Magic play is legal or optimal; it gives the simulator better play patterns while exact rules support is added over time.

## Card Behaviors

Behavior modules live in `src/cards/behaviors`.

Current behavior types:

- `DefaultBehavior`
- `RampBehavior`
- `DrawBehavior`
- `RemovalBehavior`
- `CreatureBehavior`
- `BoardWipeBehavior`
- `CounterspellBehavior`

`src/cards/CardBehavior.js` maps exact cards and tags to behavior objects. To add a new card:

1. Add or update the card record in `data/cards.starter.json`.
2. Add useful tags like `ramp`, `draw`, `removal`, `boardwipe`, `counterspell`, `wincon`, `land`, or `creature`.
3. If generic tag behavior is not enough, register a specific behavior in `createDefaultBehaviorRegistry()`.

## Reports

Simulation reports include:

- Games simulated.
- Win rate per deck.
- Average win turn.
- Average game length.
- Mana screw and flood rates.
- Average opening hand land count.
- Average cards drawn.
- Average ramp played.
- Average removal used.
- Average commander cast turn.
- Common loss reason.
- Consistency, aggression, resilience, and interaction scores.
- Estimated bracket, archetype, combo density, and pod power mismatch warnings when card data is available.
- Strategy profile summary.
- Average mulligans, risky keeps, no-land and color-screw mulligans.
- Combo attempts, combo win rate, failed and stopped combo attempts, and average combo attempt turn.
- Interaction used, counterspells used, board wipes cast, and common tutor targets.
- Win type breakdown and pod balance recommendations.

## Deck Power Analyzer

The power analyzer is heuristic. It does not claim perfect Commander bracket accuracy, and it is not a substitute for human Rule 0 discussion. It estimates deck power from local card data, tags, known combos, and broad patterns.

Run:

```bash
npm run bracket -- --deck ./decks/green-ramp.txt
npm run combos -- --deck ./decks/sample-combo.txt
npm run power -- --deck ./decks/sample-combo.txt
npm run report -- --deck ./decks/sample-thoracle-combo.txt
```

`bracket` prints an estimated 1-5 bracket, confidence, reasons, warnings, and scores for ramp, fast mana, tutors, combos, interaction, draw, protection, win speed, consistency, and pubstomp risk.

`combos` checks `data/known-combos.json` for exact deterministic combos and also reports lower-confidence tag patterns such as infinite mana shells, token sacrifice engines, and Walking Ballista counter lines.

`power` prints the full report: bracket estimate, combo findings, archetype estimate, mana report, and score breakdown.

`report` runs the full pipeline: deck import, optional hydration check, validation, card tagging, mana analysis, combo detection, archetype detection, bracket analysis, and pod mismatch warnings. Use `--skipHydrate true` when you want an offline report from the existing cache.

## Mana Analysis

`src/analysis/ManaAnalyzer.js` estimates:

- total lands
- colored source counts by W/U/B/R/G
- untapped source estimate
- tapped land count
- color fixing score
- ramp and fast mana counts
- average mana value
- early playability
- commander cast reliability
- color screw and flood risk
- mana base quality score

It uses Scryfall `produced_mana`, type lines, Oracle text, and card tags where available. The result is still heuristic: it does not yet simulate exact sequencing, fetch-land choices, replacement effects, or every conditional mana ability.

## Confidence Scoring

Bracket confidence improves when most cards are hydrated, known tags are present, and exact combo/mana signals are clear. It drops when many cards are missing, placeholder-like, or only weakly tagged. Missing cards can cause a false-low bracket, so reports warn when the analyzer lacks enough real card data.

Manual power tags live in:

```text
data/card-power-tags.json
```

Add a card by name with tags such as `fast-mana`, `tutor`, `combo-piece`, `infinite-combo-piece`, `stax`, `free-spell`, `high-impact`, or `mass-land-denial`.
The tagger also reads Oracle text for broad patterns like tutors, ramp, counterspells, board wipes, treasures, draw, protection, sacrifice outlets, and mana outlets.

Known combos live in:

```text
data/known-combos.json
```

Each combo record has `name`, `cardsRequired`, `optionalCards`, `result`, `type`, `speed`, `bracketImpact`, `explanation`, and `confidence`.

Commander-specific possible combo rules live in:

```text
data/commander-combo-rules.json
```

These rules are intentionally review prompts, not guaranteed infinites. They support commander patterns such as counters, untapping, treasures, cost reduction, copying, sacrifice, lifegain, ETB triggers, and death triggers.

Current limitations:

- Bracket estimates are scoring heuristics, not official determinations.
- Pattern combos are warnings, not proof of deterministic infinites.
- Missing card data lowers confidence.
- The analyzer does not yet understand every commander-specific line or every replacement/trigger loop.
- Simulation remains simplified and does not model exact stack timing, priority, color production, or full Oracle rules.
- Combo speed is an estimate from mana value, tutors, fast mana, draw density, commander involvement, and mana quality.
- AI decisions are scored heuristically. They should feel more deck-aware, but they are not perfect gameplay.

## Sample Decks

Decks live under `decks/precons` after importing from Wizards. Additional analyzer fixtures live in `decks`:

- `sample-casual.txt`
- `sample-high-power.txt`
- `sample-thoracle-combo.txt`
- `sample-isochron-combo.txt`
- `sample-counter-synergy.txt`

Useful checks:

```bash
npm run bracket -- --deck ./decks/sample-casual.txt
npm run combos -- --deck ./decks/sample-isochron-combo.txt
npm run report -- --deck ./decks/sample-high-power.txt
npm run strategy -- --deck ./decks/sample-thoracle-combo.txt
npm run simulate -- --deck ./decks/sample-thoracle-combo.txt --opponents ./decks/sample-casual.txt ./decks/sample-high-power.txt --games 25
```

## Latest Precon Import

Run:

```bash
npm run precons:import
```

For a quick smoke test that does not hydrate the full card cache:

```bash
npm run precons:import -- --limit 1 --cardLimit 2 --timeoutMs 8000
```

Useful safety options:

- `--limit N` imports only the first N precon decks from the current catalog.
- `--cardLimit N` looks up only the first N uncached cards from Scryfall.
- `--skipCardCache true` writes deck files without updating `data/cards.precons.json`.
- `--refreshPlaceholders true` retries generated placeholder cards against Scryfall.
- `--timeoutMs N` sets the per-request network timeout.

The importer currently targets the latest three released Commander-precon products in `data/precons.latest.json`:

- Secrets of Strixhaven
- Teenage Mutant Ninja Turtles
- Lorwyn Eclipsed

It fetches official Wizards decklist pages, writes deck files under `decks/precons`, then caches available Scryfall card data in `data/cards.precons.json`. Brand-new cards that are not available from Scryfall yet receive generated placeholder records so the simulator can still recognize commanders, lands, creatures, ramp, draw, removal, and win conditions where possible.

## Import Any Wizards Decklist Article

From the website, use **Import From Wizards**:

1. Search for a phrase like `fallout commander decklists`.
2. Pick an official Wizards result.
3. Click **Import**.

You can also paste an article URL directly, such as:

```text
https://magic.wizards.com/en/news/announcements/final-fantasy-commander-decklists
```

From the CLI:

```bash
npm run cli -- import-wizards --url https://magic.wizards.com/en/news/announcements/final-fantasy-commander-decklists --limit 1 --cardLimit 5 --timeoutMs 8000
```

The search uses Wizards' official sitemap and filters for decklist articles. The importer only accepts `magic.wizards.com` URLs.

## Import Pasted Decklists

From the website, open **Import Pasted List**, enter a deck name, and paste exported text from Manabox or Moxfield.

Supported examples:

```text
// COMMANDER
1 Commander Name

// DECK
1 Sol Ring
1 Arcane Signet
```

or:

```text
1 Commander Name
1 Sol Ring
1 Arcane Signet
```

The pasted deck is saved under `decks/imported` and appears in the Deck Library tiles.

## Import Moxfield Decks

Import a Moxfield export file:

```bash
npm run import:moxfield -- --input ./decks/moxfield-export-test.txt --output ./decks/imported/moxfield-export-test.txt
```

Import a public Moxfield URL:

```bash
npm run import:moxfield -- --url https://www.moxfield.com/decks/DECK_ID
```

Use a Moxfield URL directly for reports and simulations:

```bash
npm run report -- --moxfield https://www.moxfield.com/decks/DECK_ID
npm run simulate -- --moxfield https://www.moxfield.com/decks/DECK_ID --opponents ./decks/sample-casual.txt ./decks/sample-high-power.txt --games 25
```

Supported export sections include `Commander`, `Mainboard`, `COMMANDER:`, `CREATURES:`, `ARTIFACTS:`, and `LANDS:`. Sideboard, maybeboard, considering, tokens, and acquireboard are excluded by default. URL import uses Moxfield's public deck data endpoint conservatively; if it fails, export or copy the deck text from Moxfield and use `--input`.

## Strategy Regression Tests

Run:

```bash
npm run test:strategies
```

This runs deterministic, loose behavior checks across combo, control, aggro, ramp, voltron, tokens, aristocrats, reanimator, stax, and midrange fixtures. The tests compare relative behavior, such as control using more interaction than aggro and combo attempting more combo wins than midrange.

Run interaction-window checks:

```bash
npm run test:interaction
```

These deterministic tests cover high-impact spell counters, removal against combo engines, protection defending an important play, lethal combat windows, existing combo-attempt stopping, StackObject creation, StackManager push/pop behavior, single-object stack resolution, and stack history.

## Debug Simulation

Use `--debug` for one-game tuning:

```bash
npm run simulate -- --deck ./decks/sample-control.txt --opponents ./decks/sample-thoracle-combo.txt --games 1 --skipHydrate true --debug
```

Debug output prints important events such as tutor choices, stack object creation/push/resolution/history, interaction windows opening and closing, possible responders, selected responses, counterspells, removal, protection, attacks, combo attempts, and win conditions.

## Roadmap

- Add deeper Scryfall bulk-data refresh options.
- Improve exact mana sequencing and conditional color requirements.
- Teach the AI exact card-specific combo sequencing and exact tutor restrictions.
- Add richer control, aggro, ramp, and voltron fixture decks for strategy regression tests.
- Add partner/background commander handling.
- Add more exact card behaviors and triggered abilities.
- Grow Stack Objects v1 and Interaction Windows v1 into a fuller stack and priority model.
- Improve mulligan heuristics.
- Add richer matchup summaries.
- Add SQLite cache once the local JSON store becomes too small.
- Add optional frontend after the CLI and backend model stabilize.
