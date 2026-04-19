# Protein App — Architecture

This is the plain-language map of how the app is built. It's the companion to `spec.md`: that file says *what* the app does, this one says *how* it does it. No deep code — just enough that you can picture the pieces and see where each one lives.

---

## The big picture

There are two kinds of work happening in this app:

1. **Deterministic stuff** — math the app just does. Summing grams across items, picking the top-3 added-sugar offenders, filtering candidates for best picks. No AI needed, no prompt to tune. This lives in regular code in `/app`.

2. **Agent work** — the parts where the app needs to *understand* something: read a receipt image, estimate nutrition per item, turn a bunch of numbers into a friendly readout. Each of these is a separate model-spec (a prompt, inputs, and outputs) that runs on Claude Sonnet 4.6. These are the parts we'll actually tune over time.

The agent work is where Braintrust comes in. Every agent in this app gets its own model-spec in `/docs/model-specs/`, and the flow is: draft the spec in the doc → paste into Braintrust → iterate the prompt against synthetic fixtures → copy the working prompt back into the doc as the source of truth. **No prompts live in `/app` code.** The app pulls them from Braintrust (or a simple config) at runtime.

---

## The stack

- **Next.js on Vercel.** One app, serverless functions for any server-side work.
- **Vercel AI SDK** — the glue.
  - `@ai-sdk/anthropic` for Claude Sonnet 4.6 (all the agent work).
- **Braintrust** for two things: prompt management (each agent's prompt lives there and can be tuned fast without a code deploy) *and* live trace logging (every real agent call in the running app is sent to Braintrust so we can scroll the log, inspect inputs/outputs, see token counts and latency, and diagnose why a readout felt off).

**Data:** real receipts. Nothing persists in our own database past the session — in-memory only, no DB, no auth. Close the tab and the session state is gone. The *traces* of those agent calls do live in Braintrust's log, which is the intentional exception: that's how we debug and improve the prompts.

*Out of scope for v0, saved for v1: a synthetic fixture set and an automated eval run against it.* For now we tune prompts by running them on real input, watching the Braintrust trace log, and iterating by feel.

---

## The four agents

Four model-specs, one per agent. Two of them are parallel entry readers (receipt vs recipe); the other two are shared by both paths.

| # | Agent | Job | Input | Output | File |
|---|---|---|---|---|---|
| 1 | Receipt reader | Read a grocery receipt photo → store + items + qty | Receipt image | `{store, items[], unreadable, notes}` | `01-receipt-reader.md` |
| 2 | Nutrition estimator | Map items (with store or recipe context) → P / cal / added sugar per item | `{store, items[]}` | `[{name, qty, protein_g, cal, added_sugar_g, confidence}]` | `02-nutrition-estimator.md` |
| 5 | Readout writer | Turn pre-computed totals + best-pick candidates + sugar-hiding items into the friend's one-minute answer | Deterministic math blob | `{verdict_headline, best_pick_notes[], sugar_hiding_notes[], confidence_footnote}` | `05-readout-writer.md` |
| 6 | Recipe reader | Read a recipe webpage's HTML → recipe title + servings + ingredient list | Sanitized HTML string | `{source, servings, items[], unreadable, notes}` | `06-recipe-reader.md` |

(The file numbering keeps the original ordinal so Braintrust project IDs don't churn. Agents 03 and 04 — the pantry parser and household parser — were removed in the reveal-only rewrite. Agent 06 is new for the recipe URL feature.)

**Design decisions worth keeping visible here:**

- **Two entry readers, one estimator, one writer.** Receipt-reader and recipe-reader produce the same downstream shape (a list of items with names, so the nutrition estimator doesn't have to branch). The estimator is reused unchanged — it already handles ingredient-style names like "2 cups cooked chickpeas" because that's also how receipts sometimes print weighted items.
- **Receipt reader and nutrition estimator are two agents, not one.** Different failure modes, different evals. "What did you buy" and "how much protein is in that product" are separable skills and should be tuned separately.
- **Readout writer receives pre-computed math, not raw data.** Totals, best-pick filtering, and sugar-hiding selection all happen in `/app` before the agent runs. The agent only writes sentences about numbers it was handed. It can't invent a number.
- **Per-serving is a render-time concern, not a math-time one.** Best picks and sugar hiding operate on whole-recipe totals because the ingredient-level facts (47g protein from the chickpeas) are what the reveal is about. Per-serving numbers only appear in the tiles.
- **The app does not know who is eating the food.** No household intake, no per-person targets, no "how many days" question. Totals are raw totals; the agent interprets them in plain language.

---

## Where the non-agent work lives

Things that are *not* agents and live as regular code in `/app`:

- **Summing totals.** Straight addition of protein, calories, and added sugar across items.
- **Best picks selection.** Filter items to those with `protein_g >= 10 && added_sugar_g <= 5`, sort by `protein_g desc`, take top 8 as the candidate pool. The readout writer picks the 3 it finds most interesting and writes a note each.
- **Sugar hiding selection.** Filter items to those with `added_sugar_g >= 10`, sort descending, take top 3. The section is rendered only when at least one item qualifies. When nothing qualifies the section is simply omitted — the agent's headline is expected to cover the "clean cart" case ("You kept free of added sugar" or equivalent). No hardcoded empty-state copy.
- **Subtitle / metadata strip.** `"{N items} from {store}"` — fully server-composed.
- **Confidence flagging.** Items with `confidence !== "high"` get passed to the readout writer so it can emit a footnote.

Doing this math in code instead of asking the agent means the numbers in the tiles and on the call-out items are always right and the agent only has to write sentences about them.

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

**Tracing in production.** Every agent call in the running app is wrapped with Braintrust's tracing so inputs, outputs, latency, and token counts show up in the Braintrust log UI. A single user session produces one trace with three spans — one per agent call — so we can scroll to any specific session and see the full chain. When a readout feels wrong, we open that session's trace, look at what the readout writer was given vs. what it wrote, and fix the prompt.

---

## What the app flow looks like at runtime

One user session, top to bottom:

1. User opens the app. Static Next.js page loads. The entry screen shows two sections: receipt upload on top, recipe URL input below.
2. **Receipt path:** user taps upload → photo posts to `POST /api/receipt` → **agent 1 (receipt reader)** → **agent 2 (nutrition estimator)** → structured item list returned with `store`.
   **Recipe path:** user pastes a URL → `POST /api/recipe` → server fetches the URL, strips scripts/styles → **agent 6 (recipe reader)** → **agent 2 (nutrition estimator)** → structured item list returned with the recipe title as `store` and a `servings` count.
3. User confirms the item list (same UI for both paths).
4. `POST /api/readout` with `{store, receiptItems, servings?}` → server-side math (sum totals, filter best-pick candidates, filter sugar-hiding items, compute per-serving if servings > 1) → **agent 5 (readout writer)** → headline + best-pick notes + sugar-hiding notes + optional confidence footnote.
5. Render the readout screen.

No database writes. No persistence. Close the tab, it's gone. That's v0.

---

## Scope boundary for this doc

What's **not** in this doc because it's not built yet:

- Synthetic fixtures, eval rubrics, and calibrated LLM judges — v1 work. For v0 we tune prompts in Braintrust against real input and iterate by feel.
- Deployment and observability — out of scope for a prototype.

What's **in** this doc: the architecture, the three agents, where prompts live, and how the pieces fit together.
