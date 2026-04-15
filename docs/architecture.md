# Protein App — Architecture

This is the plain-language map of how the app is built. It's the companion to `spec.md`: that file says *what* the app does, this one says *how* it does it. No deep code — just enough that you can picture the pieces and see where each one lives.

---

## The big picture

There are three kinds of work happening in this app:

1. **Deterministic stuff** — math the app just does. Looking up a daily protein target from the USDA table, adding up grams, calculating how many days a nutrient lasts, turning that into a day of the week. No AI needed, no prompt to tune. This lives in regular code in `/app`.

2. **Transcription** — turning someone's voice into text. This is Deepgram's job. We don't write the model, we just call it through the Vercel AI SDK. One API call, one line of config.

3. **Agent work** — the parts where the app needs to *understand* something: read a receipt image, parse a family described out loud, turn a bunch of numbers into a friendly readout. Each of these is a separate model-spec (a prompt, inputs, and outputs) that runs on Claude Sonnet 4.6. These are the parts we'll actually tune over time.

The agent work is where Braintrust comes in. Every agent in this app gets its own model-spec in `/docs/model-specs/`, and the flow is: draft the spec in the doc → paste into Braintrust → iterate the prompt against synthetic fixtures → copy the working prompt back into the doc as the source of truth. **No prompts live in `/app` code.** The app pulls them from Braintrust (or a simple config) at runtime.

---

## The stack

- **Next.js on Vercel.** One app, serverless functions for any server-side work.
- **Vercel AI SDK** — the glue. One SDK, multiple providers.
  - `@ai-sdk/anthropic` for Claude Sonnet 4.6 (all the agent work).
  - `@ai-sdk/deepgram` for voice transcription (Deepgram Nova-3).
- **Braintrust** for two things: prompt management (each agent's prompt lives there and can be tuned fast without a code deploy) *and* live trace logging (every real agent call in the running app is sent to Braintrust so we can scroll the log, inspect inputs/outputs, see token counts and latency, and diagnose why a readout felt off).

**Data:** real receipts, real family, real pantry. Nothing persists in our own database past the session — in-memory only, no DB, no auth. Close the tab and the session state is gone. The *traces* of those agent calls do live in Braintrust's log, which is the intentional exception: that's how we debug and improve the prompts.

*Out of scope for v0, saved for v1: a synthetic fixture set and an automated eval run against it.* For now we tune prompts by running them on real input, watching the Braintrust trace log, and iterating by feel. Rubrics and calibrated LLM judges come when the app is worth defending against regressions.

---

## The five agents

Five model-specs, one per agent, in pipeline order. Each one is a standalone file in `/docs/model-specs/` containing only the system prompt — nothing else. The table below is the whole map; the prompts themselves are the source of truth.

| # | Agent | Job | Input (user turn) | Output | File |
|---|---|---|---|---|---|
| 1 | Receipt reader | Read a grocery receipt photo → store + items + qty | Receipt image | `{store, items[], unreadable, notes}` | `01-receipt-reader.md` |
| 2 | Nutrition estimator | Map items (with store context) → P / cal / added sugar per item | `{store, items[]}` from agent 1 | `[{name, qty, protein_g, cal, added_sugar_g, confidence}]` | `02-nutrition-estimator.md` |
| 3 | Pantry parser | Parse a voice transcript of "what's at home" → items with rough nutrition | `{transcript}` from Deepgram | `[{name, qty_estimate, protein_g, cal, added_sugar_g, confidence}]` | `03-pantry-parser.md` |
| 4 | Household parser | Parse a voice transcript describing a family → structured profiles; handle follow-ups and btw-amendments; enforce under-16 weight-loss lockout | `{transcript, priorProfiles?}` | `{profiles[], missing_field?}` | `04-household-parser.md` |
| 5 | Readout writer | Turn pre-computed totals + targets + runway into the friend's one-minute answer | Deterministic math blob (see below) | `{verdict_headline, subtitle, cards[], what_id_do[], after_state, confidence_footnote}` | `05-readout-writer.md` |

**Design decisions worth keeping visible here:**

- **Receipt reader and nutrition estimator are two agents, not one.** Different failure modes, different evals. "What did you buy" and "how much protein is in that product" are separable skills and should be tuned separately.
- **Pantry and household parsers are two agents, not one.** Same voice input channel but completely different schemas and failure modes. Merging them would mean one mediocre prompt.
- **Readout writer receives pre-computed math, not raw data.** All day-runway math, DRI lookups, top-offender sorting happens in `/app` before the agent runs. The agent only writes sentences about numbers it was handed. This is how we guarantee the headline matches the cards — the agent literally cannot invent a number.
- **Hard constraint in agent 4:** `weightLossGoal = false` for anyone under 16, always, even if the user dictated it. This is a safety requirement (AAP guideline), not a preference.
- **Hard constraint in agent 5:** headline must match card data. No aspirational summaries. Biggest trust risk in the whole app.

---

## Where the non-agent work lives

Things that are *not* agents and live as regular code in `/app`:

- **DRI lookup table.** Static JSON for the standard age bands (1–3, 4–8, 9–13, 14–18 M/F, 19–30 M/F, 31–50 M/F, 51+ M/F) with protein, calorie, and added-sugar values sourced from NIH/USDA DRI and AHA. The lookup is deterministic — pass in age and sex (and weight, for adults), get targets out. The table includes a `source_version` field so the readout can cite it. *Out of scope for v0: a periodic checker that verifies the table against the latest NIH/USDA publication and flags drift.*
- **Weight-loss deficit.** Flat −250 kcal/day applied to any profile with `weightLossGoal: true` and `age >= 16`. Only set if the user volunteered it (the agent never asks).
- **Per-person target overrides.** The targets confirmation step lets the user override any computed protein or calorie target. Stored on the profile as `protein_target_override` / `cal_target_override` and respected by `targetsForProfile`. Manual edits win until the user hits "reset."
- **Combining receipt + pantry totals.** Straight addition.
- **Day runway math.** `days_covered = totals[nutrient] / daily_family_need[nutrient]`. **Rounded to whole integers** — never decimals. The agent sees integers only.
- **Calorie status logic.** `over` only when days_covered > 1.1 × target_days. Never `short`. The app does not flag "you didn't buy enough calories."
- **Best picks selection.** For the readout's "best picks" section: filter receipt items to those with `protein_g >= 10 && added_sugar_g <= 5`, sort by `protein_g desc`, take top 3. Excludes pantry items because the celebration is about *what the user just bought*. The readout writer agent gets this list and writes a short note per item — it does not pick.
- **Sugar hiding selection.** For the readout's "where the added sugar is hiding" section: filter receipt + pantry items to those with `added_sugar_g >= 5`, sort descending, take top 3. **Only computed when `sugar.status === "over"`** — under-the-ceiling carts skip the section entirely. The agent writes a "why" line plus an optional swap or aside per item.
- **Subtitle / metadata strip.** `"{N people} · {M days} · {store}{ + pantry}"` — fully server-composed.
- **Card data.** `{ days_covered, status }` per nutrient, plus a server-computed sugar percentage. The agent never sees card strings.

Doing this math in code instead of asking the agent means the numbers in the cards and on the call-out items are always right and the agent only has to write sentences about them.

### The product-overrides table — the trust guard rail

The reveal model — "best picks" celebrating real items and "where the added sugar is hiding" pointing at specific surprise offenders — only works if the nutrition values are *exactly correct* for items the readout makes a claim about. A verdict app can survive ±20% error on a calorie count; a reveal app cannot. If we tell a family "your hamburger buns have 32g of added sugar" and the actual label says 4g, we haven't just been wrong — we've taught them a wrong fact. Trust collapses faster than for any tracker.

`/app/src/data/product-overrides.json` is the answer. It's a `{store, item_name → { protein_g, cal, added_sugar_g, per }}` lookup that runs **before** the LLM nutrition estimator. If a hit, return verified label values with confidence "high" and skip the LLM entirely for that item. If no hit, fall through to the estimator.

**Workflow**:
1. Run the app on a real receipt for the target family.
2. See which items show up in best picks or sugar hiding.
3. For each, verify against the actual product label.
4. Within ~10% of the LLM estimate? Leave it. Otherwise, add the verified numbers to `product-overrides.json`.
5. Re-run. The reveal is now true.

**Hard rule for v1**: cannot ship to a new family until the items their typical receipts will produce are covered.

This is a different concern from the **golden test fixture** (`tests/fixtures/golden-tj.json` + `npm run eval:nutrition`). The golden fixture measures the *unaided LLM estimator's* accuracy as a regression scoreboard. The override file is the *production guard rail* for items the app will actually make claims about to a real user. Two separate jobs, both required.

---

## How Braintrust fits in

For every agent above:

1. **Draft the model-spec** in `/docs/model-specs/NN-agent-name.md`. This is the source of truth: problem, inputs, outputs, prompt, failure modes, synthetic fixtures, eval rubric.
2. **Copy the prompt into Braintrust** as a new project. Wire up the fixtures as dataset rows.
3. **Iterate the prompt in Braintrust** — this is where tuning happens, not in code. Run against fixtures, watch the eval scores, adjust.
4. **When the prompt is good, copy it back into the model-spec doc.** The doc always reflects the current working version. The `/app` code loads the prompt from Braintrust at runtime (or from a pinned version if we want reproducibility).

Per our standing practice: prompts never live hardcoded in `/app`. The app code is plumbing — the prompts are the product, and they belong in a place where we can tune them fast.

**Tracing in production.** Every agent call in the running app is wrapped with Braintrust's tracing so inputs, outputs, latency, and token counts show up in the Braintrust log UI. Concretely: the Vercel AI SDK client is wrapped with `wrapAISDK` (or the equivalent OTEL exporter) and a `BRAINTRUST_API_KEY` env var is set on Vercel. A single user session produces one trace with five spans — one per agent call — so we can scroll to any specific session and see the full chain. When a readout feels wrong, we open that session's trace, look at what the readout writer was given vs. what it wrote, and fix the prompt. Traces are the closest thing to a "save" the app has.

---

## What the app flow looks like at runtime

One user session, top to bottom:

1. User opens the app. Static Next.js page loads.
2. User taps "scan receipt" → photo uploads → `POST /api/receipt` → **agent 1 (receipt reader)** → **agent 2 (nutrition estimator)** → structured item list returned.
3. User confirms items, picks days.
4. User taps "what's at home" (optional) → mic records → Deepgram transcribes → `POST /api/pantry` → **agent 3 (pantry parser)** → item list returned and merged into totals.
5. User taps "tell me about your family" → mic records → Deepgram transcribes → `POST /api/household` → **agent 4 (household parser)** → profiles returned as editable cards. If the parser asks a follow-up, the mic re-arms for one more turn.
6. Client-side math: DRI lookup per profile → family targets → combined totals ÷ targets → per-nutrient day runway → top offenders.
7. `POST /api/readout` with all of the above → **agent 5 (readout writer)** → verdict + cards + suggestions + after-state.
8. Render the readout screen.

No database writes. No persistence. Close the tab, it's gone. That's v0.

---

## Scope boundary for this doc

What's **not** in this doc because it's not built yet:

- Model-spec files themselves (`/docs/model-specs/01-*.md` through `05-*.md`) — next step.
- Synthetic fixtures, eval rubrics, and calibrated LLM judges — v1 work. For v0 we tune prompts in Braintrust against real input and iterate by feel.
- Deployment and observability — out of scope for a prototype.

What's **in** this doc: the architecture, the five agents, where prompts live, and how the pieces fit together.
