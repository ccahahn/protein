# Protein

Turn a grocery receipt into a short, specific narration of what's actually in your cart — your workhorse picks and where the added sugar is hiding.

**[Try the prototype →](https://protein-silk.vercel.app/)**

---

## Problem

You really want your family to eat enough protein, and don't know if two rotisserie chickens will cut it. Or you walk guiltily into the grocery store hungry, confident you'll walk out with way too much sugar. The receipt has the answer but nobody does the math.

## Core bet

**The app is not a verdict. It's a reveal.** If we can turn a receipt into a short, specific narration of *what's actually in your cart*, people will learn something they didn't know — and then they'll change their behavior on their own, without being told to. The two halves of that narration are:

1. **Your best picks.** The items you already chose that are quietly doing the work. ("95g protein, zero added sugar, under 800 cal. The workhorse.") Celebrates the real food you bought. Nobody does this for you.
2. **Where the added sugar is hiding.** The items adding most of the added sugar — which are almost never the items you'd guess. Hamburger buns. Flavored yogurt. Sausage. Granola. Sauces and condiments. That "wait, *really*?" reaction is the whole point — it's a learning moment, not a scolding. The family gasp at the hamburger bun is the product.

This reframe came out of running the app on a real Trader Joe's receipt with a real family. The original framing was verdict-driven ("your protein runs out in 3 days, drop the OJ, grab a rotisserie"). It worked but it felt like a tracker. The new framing *surfaces the surprising specific items in both directions* — the good and the bad — and lets the user draw their own conclusion. The family at the table was outraged about the sugar in the hamburger buns, and they remembered it for next week. That kind of recall is not something a macro tracker produces. It's the real behavior-change loop.

The protagonist of the readout is **the items**, not the macros.

**A note on "sugar":** throughout this app, when we say "sugar" we mean *added sugar* — the AHA / USDA definition that excludes natural sugars in whole fruit, plain dairy, and vegetables. A bunch of bananas has ~56g of natural sugar and 0g of added sugar. In user-visible text we say "added sugar" explicitly so nobody thinks we're counting fruit.

---

## Human bar

The person we're designing against is **the perfect friend who just knows this stuff.** They read labels without making a thing of it, and can glance at your Trader Joe's receipt and notice things you wouldn't. If you handed them your receipt, they would:

- Eyeball protein and added sugar across the whole haul without a spreadsheet or a macro app.
- **Point out the items you already chose that are doing all the work.** "The chicken thighs are a steal — 109g of protein for 979 calories. The salmon is giving you 69g for 664. That's most of your week right there, no prep." — specific, warm, educational.
- **Point out where the added sugar is actually hiding.** Not "you bought too much sugar" — something like "wait, the hamburger buns have more added sugar than the cereal box?" The specificity is the point. A nutrition label couldn't do this for you; only a friend who bothered to look could.
- Suggest a concrete swap when there's a clean one on the same receipt ("use the sliced bread instead of the buns"), or say "this one's fine in moderation, just something to know" when there isn't. Never a blanket "avoid sugar."
- Not lecture. Not prescribe. They'll say "I'm not sure about that one" when they aren't.

It is good when the readout feels like that friend pointing at the receipt and saying "wait, check this out." It is bad when it feels like a nutrition label, a macro tracker, or a verdict.

---

## Core flow

1. **Scan a receipt or paste a recipe URL.** Quiet entry point — no onboarding, no agent greeting, no app name. One italic heading ("Snap a receipt. Or paste a recipe."), one subtitle explaining what comes back and how fast, then two clearly divided sections: a photo upload zone on top, a URL input below, separated by a thin "or" divider. A first-time user picks one. Both paths converge on the same item-confirmation UI and the same readout.
   - **Receipt path:** photo goes to LLM vision, extracts store name and line items + quantities.
   - **Recipe path:** URL goes to a server-side fetch, HTML is passed to the recipe-reader agent, which extracts the recipe title, number of servings, and the ingredient list exactly as written.
2. **The readout.** Map items/ingredients to nutrition, total up protein and added sugar, surface best picks and where the added sugar is hiding. When the entry was a recipe with more than one serving, the tiles show per-serving alongside totals.

Two steps, nothing else. No household intake, no pantry, no "how many days" input. The app doesn't know your family and doesn't pretend to. It looks at the receipt or the recipe and tells you what's there.

---

## Receipt → nutrition

- **Photo upload** (camera or file). Send image directly to LLM vision — not OCR. The model sees the receipt as a human would and returns structured data in one call, handling abbreviations, wrapping lines, faded text, etc. No OCR library, no regex.
- **Store identification.** The LLM extracts the store name from the receipt (printed on every receipt). This matters for disambiguation: "Mandarin Chicken" at Trader Joe's is a specific frozen product; at Costco it's a different product with different portions. "Organic Eggs" means 1 dozen at TJ's and 2 dozen at Costco. Store context dramatically improves nutrition accuracy.
- **Parsed output:** `{ store: "Trader Joe's", items: [{item, qty}] }`. Surface the store name in the UI so the user sees it was identified ("13 items from Trader Joe's").
- Each item → nutrition estimate. For the prototype, LLM estimation is acceptable. Store context helps the model match items to specific products rather than generic categories.
- **Confidence scoring.** Each item gets a confidence level (high/medium/low). The bar for "high" is tight: must be within ~15% on all three nutrients. Prepared/composite items (dips, dressings, sauces, spreads) default to medium because the base ingredient swings the numbers 2–3×. Medium/low-confidence items are flagged with ⚠ in the item list and called out in the readout as a footnote — not mixed in with the best picks or sugar hiding surfaces.
- **Unmappable items:** the agent attempts a web/knowledge search itself before giving up. Only items still ambiguous after that get surfaced to the user for a quick "is this the right thing?" confirmation.
- **Failure state.** If the vision agent returns an empty or unusable result (photo too dark, cropped, not actually a receipt), show a "couldn't read that — try again" prompt and re-open the camera. No manual item-entry fallback in v0; the demo is the receipt-reading itself, so degrading to a form would hide the thing we're trying to prove works.

---

## Recipe URL → nutrition

A second entry point sits directly below the receipt uploader. The friend-who-found-a-recipe case — "can it do this for a recipe I saw online?" — works identically to the receipt case after the first step.

- **URL input.** A single text field with `https://…` placeholder and a Go button. Enter submits. Server fetches the URL with a real-browser User-Agent, strips `<script>` and `<style>` tags, caps the payload at ~200KB, and hands the HTML to the recipe-reader agent.
- **Recipe-reader output:** `{ source: "Moroccan Vegetable Tagine", servings: 6, items: [{name, qty: 1, confidence}] }`. Quantities stay embedded in the ingredient name ("1/4 cup extra virgin olive oil") so the downstream nutrition estimator can parse them; `qty` is always 1 for recipe items.
- **Nutrition estimation** is the same agent as the receipt path. The "store" field gets the recipe title — enough context for the model to treat the ingredient as a recipe quantity rather than a purchased unit.
- **Per-serving math.** When `servings > 1`, the readout tiles show per-serving alongside total ("87g total · 14g per serving"). Everything else in the readout stays the same — best picks and sugar hiding operate on the whole-recipe totals because the ingredient-level facts (47g protein from the chickpeas, 32g added sugar from the buns) are what the reveal is about, regardless of serving size.
- **Failure states.** Non-HTML response, 404, timeout, or "not a recipe page" all return a "try a different link" message. The URL input stays on-screen so the user can paste another one.
- **Out of scope for v0:** JSON-LD / recipe schema extraction, per-ingredient substitutions, scaling the recipe to a different serving count. The recipe-reader reads what's on the page; the rest stays in the reveal frame.

---

## The readout

The readout is structured as a **reveal**, not a verdict. The protagonist is the items, not the macros. Top to bottom:

1. **Headline** — one to two short sentences in italic serif, dynamically generated. Leads with the best news, then flags the most surprising offender if there is one. Examples: "Great protein picks. Three items are sneaking in most of the sugar." / "Solid protein from the chicken and salmon. One surprise: the hamburger buns."
2. **Metadata line** — subtitle showing the store name (e.g. "13 items from Trader Joe's").
3. **Two tiles** — compact, side by side. Both show raw totals, not day runway and not percent of a ceiling. No family context means no "days covered" and no "% of limit" — either would require inventing a denominator.
   - **Protein**: `Xg` big, "total protein" small underneath.
   - **Added sugar**: `Xg` big, "total added sugar" small underneath.
   Calories are intentionally absent from the readout surface; they live in the item breakdown only.
4. **Best picks** — label in green uppercase. Up to three cards, one per item. Each card shows the item name and a short agent-written note on the left, protein grams big in green on the right. The top card gets a green background highlight. Items are picked by the server: the highest-protein items on the receipt with low or zero added sugar. The agent writes the note — specific and concrete, never "healthy."
5. **Divider** — thin horizontal rule separating the good from the bad.
6. **Where the added sugar is hiding** — label in red uppercase. Shown whenever any item on the receipt has meaningful added sugar (≥10g). If nothing crosses that bar, the section doesn't render and the agent's headline does the work ("You kept free of added sugar." or similar — agent's call, not hardcoded). Up to three cards, one per item. Each card has:
   - Item name on the left, added sugar grams big in red on the right.
   - A one-line "why it matters" written by the agent, ideally calling out the surprise ("8× more sugar than the white bread on this same receipt" / "one box is almost half of the AHA daily ceiling for an adult").
   - **Either** a swap suggestion in accent/terracotta with an arrow prefix (`→ Just get two boxes of Corn Flakes — 8g for the entire box.`) **or** a softer italic aside in yellow for items where the point is awareness, not replacement (`Not a deal-breaker — just something to know.`). Problem and fix live on the same card.
7. **Confidence footnote** — separate italic footnote for low-confidence nutrition estimates.
8. **Collapsed item breakdown** — all items with per-line protein / cal / added sugar. High-added-sugar items highlighted. No per-person target section; the app no longer knows who's eating.

### Why this structure

The old readout was a verdict machine: "Your protein runs out in 3 days, drop the OJ, grab a rotisserie." It worked, but it felt like a tracker — it was telling users what to do. The new structure runs a much simpler version of the math (just totals) and **reveals the items on both sides** (best + hiding) and lets the user draw the conclusion. Real-family testing made the reason obvious: when a family gasped at "32g of added sugar in a hamburger bun" they remembered it for next week's shop in a way that no prescription ever would. The specificity is the product. The "wait, *really*?" is the behavior-change loop.

### Rules the readout writer must follow

- **The agent does no math.** Server picks the items; server computes totals. Agent only writes sentences about numbers it was handed.
- **Best picks never includes anything with meaningful added sugar.** Server filter: `added_sugar_g <= 5` and `protein_g >= 10`.
- **Sugar hiding runs whenever there are items with ≥10g added sugar.** Server picks the top 3; agent writes a "why" + optional swap/aside per item. When nothing qualifies, the section doesn't render — no hardcoded "clean cart" fallback; the agent writes the "you kept free of added sugar" headline itself.
- **Calories are not part of the readout surface.** No calorie tile, no calorie mention in the headline or best picks or sugar hiding. Calories are computed and shown in the item breakdown only.
- **No suggesting sugary items as a swap.** Never "buy more [any added-sugar item]."
- **Tone is warm curiosity, not cheerleading or judgment.** No emoji, no "great job," no "unhealthy."

### Confidence flags

Separate from the action items. Low/medium-confidence estimates get a small italic footnote at the bottom: "⚠ Mandarin Chicken and Peanut Butter Cups are estimates — actual added sugar could be higher."

### Collapsed details

Full item breakdown, with per-item protein / cal / added sugar. High-added-sugar items highlighted in red. That's it — no per-person target table anymore (there are no people).

---

## Scope

**In:**

- Receipt photo → parsed items + store identification
- Recipe URL → parsed ingredients + recipe title + serving count
- Item/ingredient-level nutrition estimation (with store or recipe context)
- Totals: protein and added sugar
- Per-serving totals for recipes with servings > 1
- Item-driven readout: best picks (highest protein, low added sugar) + where the added sugar is hiding (top added-sugar contributors)
- Two tiles showing total protein and total added sugar, plus per-serving when relevant

**Out (for v0):**

- Household intake, per-person targets, family day runway
- "How many days should this cover?" input
- Pantry inventory (what's already at home)
- Meal planning, recipes, per-meal breakdowns
- Multi-day tracking, history, persistence
- Barcode scanning
- Dietary restrictions
- Auth, multi-household
- "Don't buy this again" flagging. User marks an item from the readout and the app remembers it across sessions, surfacing a nudge when that item appears on a future receipt. Requires persistence, which v0 doesn't have.
- Privacy policy and terms of service. v0 runs on Cecilia's own family only; no external users, no marketing surface. Before any non-family user touches this, we need (a) a privacy policy covering what Anthropic sees, what Braintrust traces retain, and that no data persists in our own DB; (b) a ToS; (c) an explicit consent screen at first run. None of that exists yet and the app is not shareable until it does.

---

## The reveal must be true: product overrides

The whole app — best picks celebrating the chicken thighs, "wait, *really*?" on the hamburger buns — depends on the nutrition numbers being correct. A verdict app can be wrong by 30% on a calorie count and the user shrugs. A reveal app cannot. If we tell a family "the hamburger buns have 32g of added sugar" and a family member checks the label and it's actually 4g, **trust collapses harder than for any tracker**. We're not just wrong — we taught them a wrong fact.

This is non-negotiable: **before the app is shown to any real family besides Cecilia's, every item that meaningfully drives a "best pick" or a "sugar hiding" call-out must have a verified nutrition entry in `/app/src/data/product-overrides.json`.** The override is keyed by `{store, item_name}` and short-circuits the LLM nutrition estimator with a pre-LLM lookup. Estimator confidence becomes "high" automatically for any overridden item.

The workflow:

1. Run the app on a real receipt for the target family.
2. Note which items the readout calls out as best picks or sugar hiders.
3. For each one, verify the nutrition against the actual product label (the store's website or the package itself).
4. If the LLM estimate is within ~10% of the verified value across all three nutrients, leave it alone — the agent guessed well.
5. If it's off, add an override entry to `product-overrides.json` with the verified numbers.
6. Re-run. The readout now reflects truth, and the family can trust what they're being told.

For the prototype, the override file starts empty. As Cecilia tests on her own receipts, she fills it in for items she sees the agent miss. The golden test fixture (`tests/fixtures/golden-tj.json`) is the calibration scoreboard for *the agent's unaided performance*; the override file is the *production guard rail* for items the app is going to make claims about. Two different jobs, both required.

When v1 starts handing the app to non-Cecilia families, this becomes a hard release gate: cannot ship to a new family until the items their receipts will produce are covered.

---

## Guardrails & trust

- **Cite the store** in the readout so the user sees their items were matched against the right product catalog.
- **Flag uncertainty.** If the nutrition mapper is low-confidence on an item, say so as a footnote in the readout — not mixed in with the best picks or sugar hiding surfaces. Don't hide it.
- **No prescriptions beyond swaps.** The agent can suggest swapping one item for another on the same receipt. It does not tell anyone to eat more, eat less, or follow a plan.
- **No diet advice.** The app does not know who is eating the food. It does not have enough context to be smart about calories, portion sizes, or individual needs, so it stays silent on those and lets the items speak for themselves.
