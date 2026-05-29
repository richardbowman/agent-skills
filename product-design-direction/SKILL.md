# Product Design Direction

## When to use this skill

Invoke this skill **before writing any UI code** when:
- Starting a new web product or major feature area
- Doing a design overhaul of an existing product
- The current UI feels generic, uninspiring, or like "default SaaS"
- Building a white-label or multi-brand product that needs a theming strategy
- A stakeholder says anything like "it needs to feel more premium" or "it looks too generic"

**Never skip this step.** Vague direction ("feels premium") produces generic output. Concrete token values and per-screen principles produce consistent, intentional results. Establishing design direction before coding saves significant rework.

---

## Process

### Step 1: Understand the product

Before anything else, establish:

1. **Who uses it and what's at stake emotionally?**
   - Borrower filling out a mortgage application → anxious, wants to feel safe and guided
   - Loan officer managing a pipeline → needs to feel equipped and efficient
   - Lender admin configuring the platform → needs to feel in control and professional

2. **What is the product's primary job?**
   - Is it a consumer-facing trust moment? (wizard, onboarding)
   - Is it a productivity tool? (dashboard, pipeline)
   - Is it a configuration surface? (admin, settings)

3. **Who are the design reference points?**
   - Financial/premium: Stripe, Blend, Mercury, Brex
   - Productivity/precision: Linear, Notion, Raycast
   - Editorial/content: Substack, The Atlantic, Readwise
   - Consumer/approachable: Airbnb, Duolingo, Cash App

4. **Is this white-labeled?**
   - If yes: Arc's own identity is the default layer, not the brand layer. Design for extensibility.
   - Establish upfront what lenders/tenants can override vs. what stays locked.

---

### Step 2: Define brand personality

Write 3–5 **specific, concrete adjectives** for the product. Not vague ("premium", "modern") — specific:

| Bad (vague) | Good (specific) |
|---|---|
| Premium | Measured, precise, unhurried |
| Modern | Stripped of decoration, purposeful |
| Friendly | Plain-spoken, never condescending |
| Clean | High signal-to-noise, no chrome for chrome's sake |

Then define:
- **Borrower emotional goal**: How should a user feel at the end of each key interaction?
- **Power user emotional goal**: How should an expert feel after a full session?
- **Voice**: 3 words. E.g. "Confident. Precise. Calm." — not "Helpful, friendly, and modern."

---

### Step 3: Design token specification

Specify every token concretely. "A nice blue" is not a token. `#1B2B5E` is.

#### Colors

**Primary color selection:**
- Avoid the generic SaaS blues: `#3B82F6`, `#1a56db`, `#2563EB` — these read as "I used Tailwind defaults"
- For financial/premium: deep navy (`#1B2B5E`), rich indigo (`#3730A3`), dark teal (`#0F766E`)
- For consumer/approachable: warm blue (`#2563EB`), sky (`#0284C7`)
- Always define: base, hover (10% darker), active (15% darker), light tint (10% opacity on white), focus ring

**Background — never pure white for premium products:**
- Warm off-white: `#FAFAF8` (paper feel)
- Cool off-white: `#FAFBFC` (digital/precise feel)
- Warm grey: `#F9F8F5` (editorial feel)

**Surface:** Usually `#FFFFFF` against off-white background to create subtle depth.

**Full required token set:**
```css
:root {
  /* Primary */
  --color-primary: ;
  --color-primary-hover: ;
  --color-primary-active: ;
  --color-primary-tint: ;      /* 10% opacity for backgrounds */
  --color-primary-foreground: ; /* text on primary bg — almost always white */

  /* Backgrounds */
  --color-background: ;        /* page background */
  --color-surface: ;           /* card/panel background */
  --color-surface-hover: ;     /* hover state on surface */
  --color-surface-raised: ;    /* modals, popovers */

  /* Text */
  --color-text: ;              /* headings — never pure black */
  --color-text-secondary: ;    /* body copy */
  --color-text-muted: ;        /* labels, captions */
  --color-text-disabled: ;

  /* Borders */
  --color-border: ;            /* default border */
  --color-border-strong: ;     /* emphasized border */

  /* Status — minimal, semantic */
  --color-success: ;
  --color-warning: ;
  --color-destructive: ;
  --color-info: ;

  /* Typography */
  --font-display: ;            /* serif/editorial — for headings */
  --font-ui: ;                 /* sans — for all interface text */
  --font-mono: ;               /* for reference numbers, code */

  /* Radius */
  --radius-sm: ;               /* inputs, small chips */
  --radius-base: ;             /* buttons, default */
  --radius-md: ;               /* cards */
  --radius-lg: ;               /* large cards, modals */
  --radius-xl: ;               /* hero containers */
  --radius-full: 9999px;       /* pills, avatars */

  /* Shadows — use dark blue-black, not grey */
  --shadow-sm: ;               /* subtle card lift */
  --shadow-base: ;             /* default elevation */
  --shadow-md: ;               /* dropdowns, popovers */
  --shadow-lg: ;               /* modals */

  /* Motion */
  --duration-fast: 100ms;
  --duration-base: 200ms;
  --duration-slow: 350ms;
  --ease-base: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-out: cubic-bezier(0, 0, 0.2, 1);
}
```

#### Typography

**The pairing model:**
- **Display/Editorial font** — used for page headings, step titles, hero moments, success states. Creates warmth, humanity, gravitas.
- **UI font** — used for everything else: body copy, labels, buttons, inputs, navigation, metadata.

**Never use one font for everything** in a premium product. The contrast between serif headings and clean sans UI is what creates sophistication.

**Curated Google Fonts pairings by product personality:**

| Personality | Display | UI | Feel |
|---|---|---|---|
| Financial / premium | DM Serif Display | DM Sans | Modern banking, precise |
| Financial / premium | Fraunces | Inter | Warm trust, editorial |
| Financial / trust | Playfair Display | Outfit | Classic, established |
| Modern SaaS | Sora | Sora | Unified, techy |
| Modern SaaS | Cabinet Grotesk | Inter | Startup, confident |
| Editorial / content | Lora | Instrument Sans | Readable, editorial |
| Consumer / friendly | Nunito | Nunito Sans | Approachable, rounded |

**Typography scale rules:**
- Step headings and major UI moments → display font, medium or semibold
- Body, labels, nav, buttons, inputs → UI font
- Reference numbers, codes, IDs → monospace
- Never center-align body text
- Never all-caps for headings (sentence case everywhere)
- Never pure black text — use `#111928` or `#0F172A` for headings, `#374151` for body

#### Spacing
Always use an 8px system. Name the steps:
- `space-1`: 4px (tight inline)
- `space-2`: 8px (compact)
- `space-3`: 12px
- `space-4`: 16px (default gap)
- `space-6`: 24px (section internal)
- `space-8`: 32px (section gap)
- `space-12`: 48px (major section)
- `space-16`: 64px (hero/page-level)

#### Border radius
- `sm`: 4–6px — tags, badges, small chips
- `base`: 8px — inputs, buttons
- `md`: 12px — cards, panels
- `lg`: 16px — large cards, modals
- `xl`: 24px — hero containers, featured sections

#### Shadows
Use dark blue-black (`rgb(15 23 42 / 0.X)`) not grey (`rgb(0 0 0 / 0.X)`):
- `sm`: `0 1px 2px 0 rgb(15 23 42 / 0.05)`
- `base`: `0 1px 3px 0 rgb(15 23 42 / 0.08), 0 1px 2px -1px rgb(15 23 42 / 0.05)`
- `md`: `0 4px 6px -1px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.05)`
- `lg`: `0 10px 15px -3px rgb(15 23 42 / 0.08), 0 4px 6px -4px rgb(15 23 42 / 0.05)`

---

### Step 4: Key screen principles

For each major screen/flow, document:
1. **Emotional intent** — how should the user feel on this screen?
2. **Layout principle** — density level, key hierarchy decisions
3. **Typography role** — where does the display font appear? What's the key heading?
4. **Signature element** — what one thing makes this screen feel intentional?
5. **Anti-pattern to avoid** — what would make this screen generic?

Example format:

```
## Wizard / Onboarding Flow

**Emotional intent:** Guided, calm, one thing at a time. Never overwhelming.

**Layout:** One question per screen. Full viewport focus. No sidebars.

**Typography:** Step heading in display font — large, warm, human. 
"What's your goal?" reads as a conversation, not a form field.

**Signature element:** Option cards (not radio buttons). 
Large, tappable, with clear selected state. The selected card 
should feel chosen, not just checked.

**Anti-pattern:** A form with 6 fields on one screen. 
Progress bar that looks like a loading indicator.
```

---

### Step 5: White-label / theming strategy

If the product needs multi-brand support:

**The three-layer model:**
1. **Platform defaults** — the product's own identity. Full design system applied.
2. **Tenant overrides** — colors, fonts, logo. Stored in DB (`themeConfig`), injected as CSS vars.
3. **Never-override locks** — spacing, motion, radius, shadows. Tenants can't break the experience.

**What to expose to tenants:**
```
✅ Override: --color-primary and its scale
✅ Override: --font-display, --font-ui
✅ Override: --logo-url, --logo-width, --logo-height
✅ Override: --color-background, --color-surface
❌ Lock: spacing system
❌ Lock: motion/timing
❌ Lock: border radius system
❌ Lock: shadow system
```

**Auto-generate the primary scale from one input:**
When a lender sets `primaryColor: "#E8342A"` — don't make them specify 8 shades. Generate:
- 50 tint: mix 5% with white
- 100 tint: mix 10% with white
- hover: darken 8%
- active: darken 15%
- focus ring: 40% opacity

**Admin UI copy guidance:**
Surface constraints to lenders in plain language:
> "Your primary color is used for buttons, links, and active states. Dark colors work best — we'll generate all the tints automatically."

---

### Step 6: Signature moments

Identify 3–5 specific interactions that prove the design direction was actually implemented. These are the moments that make someone say "this feels premium."

For each, specify:
- **What it is**
- **Trigger**
- **Animation spec**: duration, easing, what moves
- **Why it matters**

Examples:
- Wizard step transition: content slides/fades with stagger on entry elements
- Success screen: reference number appears with scale + fade after a brief pause
- Status timeline: progress dots animate in sequentially on mount
- Pipeline row hover: action button reveals with opacity transition

If these moments aren't implemented, the design direction failed — no matter how good the tokens are.

---

### Step 7: Anti-patterns

Explicitly document what NOT to do. This is as important as the positive spec.

Format each as: **Don't → Do**

| Don't | Do |
|---|---|
| Use pure white (`#FFFFFF`) as the page background | Use a subtle off-white (`#FAFBFC`) — adds depth |
| Use the same font for headings and body | Pair a display font for headings with a clean sans for UI |
| Use status rainbow colors (red/orange/yellow/green/blue for 5 states) | Use 3–4 semantic status colors maximum |
| Use heavy drop shadows | Use low-opacity, directional shadows with dark blue-black |
| Show multiple form fields per wizard step | One question, one decision per step |
| Use all-caps for labels | Sentence case everywhere |
| Use generic `#3B82F6` / `#1a56db` blue | Choose a primary that reads as intentional for this product |
| Use borders to create structure | Use whitespace and typography hierarchy |
| Animate everything | Animate the 3–5 moments that matter; everything else is instant |

---

## Output format

The deliverable is a **design direction document** saved to the project vault:

```
Technology/[Product Name] — Design Direction.md
```

Structure:
1. Brand identity + personality
2. Full CSS token specification (ready to paste into `default.css` or equivalent)
3. Per-screen principles (one section per major screen/flow)
4. White-label strategy (if applicable)
5. Signature moments with full animation specs
6. Anti-patterns table
7. Implementation checklist

---

## Implementation checklist

After writing the direction document, track these before starting UI code:

- [ ] CSS variables file updated with all tokens
- [ ] Google Fonts imported in layout (or next/font configured)
- [ ] Tailwind config extended with color/font/radius tokens
- [ ] Per-screen principles reviewed with product owner
- [ ] Signature moments approved and ticketed
- [ ] Anti-patterns shared with team

---

## Key principles

1. **Direction before code** — never write a component before the tokens exist
2. **Specificity is kindness** — vague direction produces generic output; hex values produce consistent results
3. **The anti-pattern list is the spec** — what you explicitly forbid is as defining as what you prescribe
4. **Signature moments are the proof** — if the 3–5 key animations aren't implemented, the direction wasn't followed
5. **White-label = layered, not flexible everything** — expose exactly what lenders need; lock everything else
