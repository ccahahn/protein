# Protein

![next.js](https://img.shields.io/badge/next.js-16.2.3-black?style=flat-square) ![claude code](https://img.shields.io/badge/claude%20code-2.1.141-orange?style=flat-square)

Snap a picture of your grocery receipt to see how much protein and added sugar you are taking home. Be surprisingly proud about taking home the ready-made lasagna packed with protein or think again before buying hamburger buns with 3x more added sugar than sliced white bread. 

**[Try the prototype →](https://protein-silk.vercel.app/)**

![[protein_mobile_homepage.png|182]] ![[protein_mobile_demo.png|180]]
---

## Core bet
*Written by AI after much prompting and experimenting with versions of the app.*

**The app is a reveal, not judgment.** If we can turn a receipt into a short, specific narration of *what's actually in your cart*, people will learn something new and possibly change their behavior on their own, without being told to.

1. **Highlight your best picks.** Celebrates the real food you bought ("95g protein, zero added sugar, under 800 cal."). Nobody does this for you. Now Protein does. 
2. **Share where the added sugar is hiding.** The items adding most of the added sugar may be the ones you'd never guess. Hamburger buns. Flavored yogurt. Sausage. Granola. Sauces and condiments. That "wait, *really*?" reaction is a moment of reflection, which may turn into a behavior change the next time at the store. 

This reframe came out of running the app on a real Trader Joe's receipt with a real family. The original framing was verdict-driven ("your protein runs out in 3 days, drop the OJ, grab a rotisserie"). It worked but it felt like a tracker. The new framing *surfaces the surprising specific items in both directions*, the good and the bad, and lets the user draw their own conclusion. The family at the table was outraged about the sugar in the hamburger buns, and they remembered it for next week. That kind of recall is not something a macro tracker produces. It's the real behavior-change loop.

**A note on "sugar":** throughout this app, when we say "sugar" we mean *added sugar*: the AHA / USDA definition that excludes natural sugars in whole fruit, plain dairy, and vegetables. A bunch of bananas has ~56g of natural sugar and 0g of added sugar. In user-visible text we say "added sugar" explicitly so nobody thinks we're counting fruit.
