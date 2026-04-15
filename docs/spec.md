## Problem

You really want your family to eat enough protein, and don't know if two rotisserie chickens will cut it. Or you walk guiltily into the grocery store hungry, confident you'll walk out with way too much sugar. The receipt has the answer but nobody does the math.

## Core bet

**The app is not a verdict. It's a reveal.** If we can turn a receipt + a pantry + the family into a short, specific narration of *what's actually in your cart*, people will learn something they didn't know — and then they'll change their behavior on their own, without being told to. The two halves of that narration are:

1. **Your best picks.** The items you already chose that are quietly doing the work. ("95g protein, zero added sugar, under 800 cal. The workhorse.") Celebrates the real food you bought. Nobody does this for you.
2. **Where the added sugar is hiding.** The items adding most of the added sugar — which are almost never the items you'd guess. Hamburger buns. Flavored yogurt. Sausage. Granola. Sauces and condiments. That "wait, *really*?" reaction is the whole point — it's a learning moment, not a scolding. The family gasp at the hamburger bun is the product.

This reframe came out of running the app on a real Trader Joe's receipt with a real family. The original framing was verdict-driven ("your protein runs out in 3 days, drop the OJ, grab a rotisserie"). It worked but it felt like a tracker. The new framing runs the same math but *surfaces the surprising specific items in both directions* — the good and the bad — and lets the user draw their own conclusion. The family at the table was outraged about the sugar in the hamburger buns, and they remembered it for next week. That kind of recall is not something a macro tracker produces. It's the real behavior-change loop.

The verdict math still runs underneath (protein runway, sugar ceiling, calorie context) — it drives which items get surfaced and which status badges show — but the protagonist of the readout is **the items**, not the macros.

**A note on "sugar":** throughout this app, when we say "sugar" we mean *added sugar* — the AHA / USDA definition that excludes natural sugars in whole fruit, plain dairy, and vegetables. A bunch of bananas has ~56g of natural sugar and 0g of added sugar. In user-visible text we say "added sugar" explicitly so nobody thinks we're counting fruit.

---

## Human bar

The person we're designing against is **the perfect friend who just knows this stuff.** They read labels without making a thing of it, and can glance at your Trader Joe's receipt and notice things you wouldn't. If you handed them your receipt and said "this is for 5 days, here's who lives in my house," they would:

- Eyeball protein, calories, and added sugar across the whole haul without a spreadsheet or a macro app.
- Know without looking it up that a 6-year-old and a 34-year-old don't need the same amount of protein, and that added sugar is the thing that sneaks up on you.
- Ask "what do you already have at home?" before giving a verdict — because a receipt is never the full picture.
- **Point out the items you already chose that are doing all the work.** "The chicken thighs are a steal — 109g of protein for 979 calories. The salmon is giving you 69g for 664. That's most of your week right there, no prep." — specific, warm, educational.
- **Point out where the added sugar is actually hiding.** Not "you bought too much sugar" — something like "wait, the hamburger buns have more added sugar than the cereal box?" The specificity is the point. A nutrition label couldn't do this for you; only a friend who bothered to look could.
- Suggest a concrete swap when there's a clean one on the same receipt ("use the sliced bread instead of the buns"), or say "this one's fine in moderation, just something to know" when there isn't. Never a blanket "avoid sugar."
- Not lecture. Not prescribe. Not put anyone under 16 on a diet without a doctor involved. They'll say "I'm not sure about that one" when they aren't.

It is good when the readout feels like that friend pointing at the receipt and saying "wait, check this out." It is bad when it feels like a nutrition label, a macro tracker, or a verdict.

---

## Core flow

1. **Scan a receipt.** Photo of a receipt. LLM vision extracts store name, line items + quantities. User confirms and specifies how many days the groceries should cover.
2. **What's at home?** Optional voice-dictated pantry inventory. User describes what they already have ("pound of ground turkey, big bag of rice, some pasta"). Agent parses into items and folds into totals. Skippable.
3. **Dictate your household.** User taps record and describes their family in natural language. Agent parses into structured profiles with editable cards.
4. **The readout.** Map items to nutrition, compare against family targets, deliver plain-language verdict with per-nutrient day runway, actionable suggestions, and after-state.

The receipt goes first — it's the thing in your hand. The pantry is the natural follow-up ("what else do you have?"). Household is last because it sizes the need against the supply. The readout brings it all together.

---

## Receipt → nutrition

- **Photo upload** (camera or file). Send image directly to LLM vision — not OCR. The model sees the receipt as a human would and returns structured data in one call, handling abbreviations, wrapping lines, faded text, etc. No OCR library, no regex.
- **Store identification.** The LLM extracts the store name from the receipt (printed on every receipt). This matters for disambiguation: "Mandarin Chicken" at Trader Joe's is a specific frozen product; at Costco it's a different product with different portions. "Organic Eggs" means 1 dozen at TJ's and 2 dozen at Costco. Store context dramatically improves nutrition accuracy.
- **Parsed output:** `{ store: "Trader Joe's", items: [{item, qty}] }`. Surface the store name in the UI so the user sees it was identified ("13 items from Trader Joe's").
- Each item → nutrition estimate. For the prototype, LLM estimation is acceptable. Store context helps the model match items to specific products rather than generic categories.
- **Confidence scoring.** Each item gets a confidence level (high/medium/low). Medium/low-confidence items are flagged with ⚠ in the item list and called out in the readout as a footnote — not mixed in with actionable suggestions.
- **Unmappable items:** the agent attempts a web/knowledge search itself before giving up. Only items still ambiguous after that get surfaced to the user for a quick "is this the right thing?" confirmation.
- **Duration input.** After confirming items, user specifies how many days the groceries should last (simple stepper, one number).
- **Failure state.** If the vision agent returns an empty or unusable result (photo too dark, cropped, not actually a receipt), show a "couldn't read that — try again" prompt and re-open the camera. No manual item-entry fallback in v0; the demo is the receipt-reading itself, so degrading to a form would hide the thing we're trying to prove works.

---

## What's at home (optional pantry input)

A receipt is never the full picture. Nobody buys all their calories in one trip — you've got rice, pasta, frozen chicken, pantry staples. Without pantry context, calories will always look short and the readout won't feel trustworthy.

- **Prompt:** "Anything at home I should count — *from before this trip*? Stuff in the fridge, freezer, pantry — whatever you already had before today's shop. Don't re-list the bags you just unpacked."

The "before this trip" framing is load-bearing — without it, users describe what they just put away and the receipt gets double-counted. The prompt itself is the dedupe mechanism; we do not try to diff receipt items against pantry items after the fact.
- **Input:** voice dictation, transcribed by Deepgram Nova-3 (same pipeline as household). Agent parses into items with rough nutrition estimates.
- **Display:** parsed items shown as pills/tags for quick confirmation.
- **Skippable.** "Skip — just use the receipt" link beneath the mic button. The readout works without it but will be less accurate on calories especially.
- Pantry items get folded into receipt totals for the assessment. In the item breakdown, receipt items and pantry items are shown in separate labeled sections.

---

## Household intake (voice → structured profiles)

**Input:** voice dictation, transcribed to text (Deepgram Nova-3 via the Vercel AI SDK's `@ai-sdk/deepgram` provider), parsed by a Claude agent into structured profiles.

**Fields the agent must extract per person:**

- Name (optional — fallback to "Person 2" etc.)
- Age (required)
- Sex (required for age ≥ 16; needed for DRI lookup)
- Weight (required for age ≥ 16, in lbs or kg — protein DRI is weight-based and reference body weights are too lossy on the nutrient the app is named after; for under-16s we still use age-band RDA and don't ask)

The app does **not** proactively ask about weight-loss goals. Protein and added sugar — the nutrients driving the readout — don't change with a weight-loss goal (you still need the same protein; the added-sugar ceiling is the same), and calories are the secondary story, not the headline. Asking turns a grocery app into a diet app.

**But: if the user volunteers it, honor it.** If someone says "I'm trying to lose a few pounds" for an adult during household dictation, record `weightLossGoal: true` for that person, apply the −250 kcal/day deficit to their calorie target only, and show it on their profile card so they can toggle it back off. The agent never asks the follow-up; it only captures what was volunteered. Under-16 lockout still applies regardless (see Guardrails).

**If the agent is missing a required field,** it asks a targeted follow-up ("How old is Ada?") rather than dumping a form. One missing field at a time.

**Editable cards:** after parsing, show each person as a tappable card with toggleable fields (sex M/F, weight-loss on/off). The user can correct by voice or by tapping directly. This handles the case where the agent misheard or the user wants to change their mind.

**Confirmation step:** before moving on, the agent confirms the household and lets the user correct.

**Voice UX:** Deepgram Nova-3 endpointing handles auto-stop on natural pauses — the user doesn't need to hit "stop." Tap-to-record, speak, pause, transcript appears. If the user stalls mid-dictation, the endpointer closes the turn on its own and sends what's been said so far. Pantry intake uses the same pattern.

**Max follow-up turns:** the household parser is capped at 3 follow-up rounds (see agent 04, rule 3a). After that, the app moves on with whatever's been parsed and falls back to reference body weight for anyone still missing weight — the readout flags the fallback so the user can correct it on the profile card if they care.

---

## Deriving daily targets

Per-person daily targets for **protein, calories, added sugar** come from published guidelines.

- **Protein:** USDA DRI 0.8 g/kg × actual body weight for anyone age ≥ 16 (dictated during household intake). For children, use age-band RDA (no weight input — age band is the standard for minors).
- **Calories:** USDA DRI estimated energy requirement by age + sex + activity. Assume "sedentary" baseline unless we add activity later. If the user volunteered a weight-loss goal for an adult (age ≥ 16) and the agent captured it, apply a **−250 kcal/day** deficit (≈0.5 lb/week loss) to that person's target only.
- **Added sugar:** AHA / USDA guidance — 25 g/day for adult women and children, 36 g/day for adult men. (Not age-DRI, but the standard public-health ceiling.)

We bake a reference table into the app covering standard DRI age bands (1–3, 4–8, 9–13, 14–18 M/F, 19–30 M/F, 31–50 M/F, 51+ M/F). The user never picks a band — we look it up from the age they dictate. Source: NIH / USDA DRI tables. Cite the source in the readout so the user can trust the numbers.

**Weight units:** DRI is kg-based. For adults (age ≥ 16) we ask for weight during household intake (lbs or kg both accepted; converted internally). For children under 16 we use age-band RDA and don't ask for weight.

---

## The readout

The readout is structured as a **reveal**, not a verdict. The protagonist is the items, not the macros. Top to bottom:

1. **Progress bar** — four segments, showing which step of the flow the user is on (receipt → pantry → household → readout). Replaces the old app-name header.
2. **Headline** — one to two short sentences in italic serif, dynamically generated. Leads with the best news, then flags the problem if there is one. Examples: "Great protein picks. Three items are sneaking in all the sugar." / "Protein's dialed. The Cocoa Puffs alone are half your family's sugar budget." / "You're set across the board."
3. **Metadata line** — subtitle showing "N people · M days · {store} [+ pantry]". Same as before.
4. **Two tiles** — compact, side by side. Calories are intentionally absent from the readout surface; they live in the item breakdown only. The two nutrients the app is actually *about* are protein and added sugar:
   - **Protein**: `X/Y days covered` with the covered number big, target small. Green if covered, red if short.
   - **Added sugar**: `X% of your limit`. Green if under, red if over. Percentage, not day count — percentages read as "budget used" which is the right mental model for a ceiling.
5. **Best picks** — label in green uppercase. Up to three cards, one per item. Each card shows the item name and a short agent-written note on the left, protein grams big in green on the right. The top card gets a green background highlight. Items are picked by the server: the highest-protein items on the receipt with low or zero added sugar. The agent writes the note — specific and concrete, never "healthy."
6. **Divider** — thin horizontal rule separating the good from the bad.
7. **Where the added sugar is hiding** — label in red uppercase. Shown only when the family's sugar ceiling is exceeded. Up to three cards, one per item. Each card has:
   - Item name on the left, added sugar grams big in red on the right.
   - A one-line "why it matters" written by the agent, ideally calling out the surprise ("8× more sugar than the white bread on this same receipt" / "one box is almost half your family's sugar budget for the week").
   - **Either** a swap suggestion in accent/terracotta with an arrow prefix (`→ Just get two boxes of Corn Flakes — 8g for the entire box.`) **or** a softer italic aside in yellow for items where the point is awareness, not replacement (`Not a deal-breaker — just something to know.`). Problem and fix live on the same card.
8. **Confidence footnote** — separate italic footnote for low-confidence nutrition estimates. Unchanged.
9. **Collapsed sections** — unchanged from prior version:
   - **Item breakdown** — all items with per-line protein / cal / added sugar, receipt and pantry in labeled groups, high-added-sugar items highlighted.
   - **Per-person targets** — how each person's daily needs were derived, with source citations.

### Why this structure

The old readout was a verdict machine: "Your protein runs out in 3 days, drop the OJ, grab a rotisserie." It worked, but it felt like a tracker — it was telling users what to do. The new structure runs the same math underneath but inverts the presentation: instead of prescribing, it **reveals the items on both sides** (best + hiding) and lets the user draw the conclusion. Real-family testing made the reason obvious: when a family gasped at "32g of added sugar in a hamburger bun" they remembered it for next week's shop in a way that no prescription ever would. The specificity is the product. The "wait, *really*?" is the behavior-change loop.

### Rules the readout writer must follow

- **The agent does no math.** Server picks the items; server computes days, percentages, totals. Agent only writes sentences about numbers it was handed.
- **Headline must match the status fields.** If `sugar.status === "over"`, the headline must say so. Non-negotiable.
- **Best picks never includes anything with meaningful added sugar.** Server filter: `added_sugar_g <= 5` and `protein_g >= 10`.
- **Sugar hiding section is only shown when sugar is over.** If the family is under the ceiling, the section doesn't render at all.
- **Calories are not part of the readout surface.** No calorie tile, no calorie mention in the headline or best picks or sugar hiding. Calories are computed and shown in the item breakdown only. The app doesn't have enough context to be smart about calories, so it stays silent — protein and added sugar are the story.
- **No suggesting sugary items as a swap.** Never "buy more [any added-sugar item]."
- **Days are whole numbers.** Never "2.7 / 5."
- **No day-of-week names.** Relative / whole integers only.
- **Tone is warm curiosity, not cheerleading or judgment.** No emoji, no "great job," no "unhealthy."

### Confidence flags

Separate from the action items. Low/medium-confidence estimates get a small italic footnote at the bottom: "⚠ Mandarin Chicken and Peanut Butter Cups are estimates — actual added sugar could be higher." Not a yellow card sitting next to the real suggestions — different type of information, different treatment.

### Collapsed details

Available but not in your face:

- **Full item breakdown** — receipt items and pantry items in labeled sections, with per-item protein / cal / added sugar. High-added-sugar items highlighted in red.
- **Per-person target calculations** — how each person's daily needs were derived, with source citations (USDA DRI, AHA, AAP).

---

## Scope

**In:**

- Receipt photo → parsed items + store identification
- Days-covered input
- Optional pantry inventory (voice-dictated)
- Voice dictation → parsed household with editable cards
- DRI-derived targets for protein / calories / added sugar (with per-person edit + override on a confirmation step)
- Item-driven readout: best picks (highest protein, low added sugar) + where the added sugar is hiding (top added-sugar contributors when over the ceiling)
- Three nutrient tiles showing day runway (protein, calories) and percent of limit (added sugar)

**Out (for v0):**

- Meal planning, recipes, per-meal breakdowns
- Multi-day tracking, history, persistence
- Barcode scanning
- Activity level, exact weight input, medical conditions
- Dietary restrictions beyond the three nutrients
- Auth, multi-household
- Asking about weight-loss proactively (honored if volunteered; see household intake section)
- "Don't buy this again" flagging. User marks an item from the readout ("the OJ was the problem — don't let me forget next time") and the app remembers it across sessions, surfacing a nudge when that item appears on a future receipt. Requires persistence, which v0 doesn't have — parked until we have a store for session history.
- Privacy policy and terms of service. v0 runs on Cecilia's own family only; no external users, no marketing surface. Before any non-family user touches this, we need (a) a privacy policy covering what Deepgram and Anthropic see, what Braintrust traces retain, and that no data persists in our own DB; (b) a ToS; (c) an explicit consent screen at first run. None of that exists yet and the app is not shareable until it does.

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

This is the difference between "directional within 15% is the bar" (what the spec says for general estimates) and "exact label values are the bar for any item we make a story about" (the reveal premise).

For the prototype, the override file starts empty. As Cecilia tests on her own receipts, she fills it in for items she sees the agent miss. The golden test fixture (`tests/fixtures/golden-tj.json`) is the calibration scoreboard for *the agent's unaided performance*; the override file is the *production guard rail* for items the app is going to make claims about. Two different jobs, both required.

When v1 starts handing the app to non-Cecilia families, this becomes a hard release gate: cannot ship to a new family until the items their receipts will produce are covered.

---

## Guardrails & trust

- **Cite the source** for daily targets (NIH/USDA DRI, AHA for added sugar).
- **Cite the store** in the readout so the user sees their items were matched against the right product catalog.
- **Flag uncertainty.** If the nutrition mapper is low-confidence on an item, say so as a footnote in the readout — not mixed in with action items. Don't hide it.
- **No proactive weight-loss prompting.** The agent never asks whether anyone is trying to lose weight. Only captures it if the user volunteers it for an adult.
- **Under-16 weight-loss lockout.** If the user volunteers a weight-loss goal for anyone under 16, the agent records `weightLossGoal: false`, populates `locked_reason` with the AAP-guideline explanation, and confirms back without the goal. AAP Clinical Practice Guideline for the Evaluation and Treatment of Children and Adolescents With Obesity (Pediatrics, Feb 2023) — weight goals for kids under 16 should involve a pediatrician, not a grocery app. State it once, move on.
- **Headline must match the cards.** If the verdict says "fine on calories" but the card shows 1.8 of 5 days, trust is blown instantly. The headline is generated dynamically from the data — never hardcoded, never aspirational.