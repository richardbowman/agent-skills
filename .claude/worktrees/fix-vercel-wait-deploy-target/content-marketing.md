# Content Marketing Skill — Golden Wealth

Use this skill whenever the user asks to write a blog post, add a landing page, audit content, or execute against the Golden Wealth content calendar.

---

## Project context

- **Repo:** `~/projects/golden-wealth-app`
- **Active worktree:** check with `git worktree list` — content work lives on the `content-marketing` branch
- **Strategy doc:** `marketing/content-marketing-strategy.md` — read this if you need the full content calendar, keyword targets, or KPI framework
- **Target audience:** Upper-middle-class families ($80k–$200k HHI), ages 40–60, homeowners with kids. NOT ultra-high-net-worth. NOT lawyers or advisors. Avoid luxury/legacy framing. Write for people who are procrastinating, not people who have it figured out.

---

## Voice & tone

- **Direct and practical.** No fluff. Every sentence earns its place.
- **Warm but not hand-holdy.** Treat the reader as a capable adult who just hasn't gotten around to this yet.
- **Specific over vague.** "You could lose $40,000 to probate fees" beats "this can be costly."
- **No jargon without explanation.** Define "probate," "intestate," "TOD" the first time they appear.
- **Never use:** "legacy," "wealth transfer," "high-net-worth," "ultra-wealthy," "generational wealth" (too formal/aspirational for our audience)
- **Do use:** "family," "your kids," "when something happens," "get organized," "protect your family"

---

## Content pillars & CTA mapping

| Pillar | TypeScript value | Typical CTA | Maps to |
|---|---|---|---|
| Estate Preparedness | `preparedness` | Take the free quiz | Quiz, panic moment |
| Document & Asset Organization | `organization` | Get started free / Vault | Document Vault |
| Wills & Legal Basics | `legal` | Start your will free | AI Will Builder |
| Family Wealth Conversations | `family` | Get started free | Family Access, shared planning |
| News & Law Updates | `news` | Get started free | General awareness / sign up |

---

## Content calendar (remaining backlog)

The full queue lives in `marketing/content-marketing-strategy.md` — always read that file for the current state. Target cadence is 2 posts per week. Take the next unwritten slug from the "Queue — write next" table in order.

---

## Workflow: writing a new blog post

### Step 1 — Pick the post
If the user didn't specify, take the next unwritten item from the calendar above (in month order).

### Step 2 — Write the markdown body
- File location: `content/blog/<slug>.md`
- **Body only — no frontmatter, no YAML header.** Start directly with a `# Title` heading.
- Target 1,200–1,800 words. Longer is fine for high-intent posts (legal pillar).
- Structure: intro → 2–4 H2 sections → conclusion with CTA mention
- Embed 1–2 internal links naturally (e.g. link "estate planning checklist" to `/estate-planning-checklist`)
- End with a soft CTA paragraph pointing to the product feature that matches the pillar

**For monthly law roundups** (`news` pillar, slug `law-updates-YYYY-MM`):
- Title: "Estate Planning Law Updates: [Month] [Year]"
- Cover 3–5 actual or plausible recent developments: federal legislation, IRS rule changes, SECURE Act updates, state probate law changes, court rulings affecting estate planning
- Format: short intro → one H2 per item with a 2–3 paragraph explainer → "What this means for your family" closing
- Keep it practical — explain what each change means for an average family, not legal jargon
- ~1,000 words is sufficient; these are news-format, not deep guides

### Step 3 — Register in lib/blog.ts
Add an entry to the `POSTS` array in `lib/blog.ts`:
```ts
{
  slug: 'your-slug',
  title: 'Full Title Here',
  description: 'One-sentence meta description, 140–160 chars, written for search.',
  publishedAt: 'YYYY-MM-DD',  // use today's date or scheduled date
  author: 'Golden Wealth Team',
  tags: ['tag1', 'tag2', 'tag3'],  // 3–5 lowercase tags
  pillar: 'legal',  // one of: preparedness | organization | legal | family
}
```
Append to the array — order doesn't matter, `getAllPosts()` sorts by date.

### Step 4 — Verify
- Read the file back and confirm no frontmatter crept in
- Check the slug matches between the filename, the `POSTS` entry, and any internal links

---

## Workflow: adding a landing page

Landing pages live at `app/<slug>/page.tsx`. They are Server Components with:
- `export const metadata: Metadata` with title, description, canonical URL, openGraph
- `MarketingNav` + `MarketingFooter` from `@/components/marketing/marketing-nav`
- A hero section with H1, subhead, and primary CTA button
- 3–5 content sections (checklist, features, FAQ, or stats)
- `QuizCtaSection` or a signup CTA near the bottom
- No `'use client'` — these are static pages

Existing examples: `app/estate-planning-checklist/page.tsx`, `app/what-happens-without-a-will/page.tsx`

After creating the page, add it to `app/sitemap.ts` if it's not already listed.

---

## Workflow: content audit

When asked to audit, check:
1. All posts in `lib/blog.ts` have matching `.md` files in `content/blog/`
2. All `.md` files are registered in `lib/blog.ts`
3. `publishedAt` dates are not in the future (unless intentionally scheduled)
4. Each post has a description between 140–160 characters
5. `app/sitemap.ts` includes all blog posts and landing pages
6. Internal links in markdown point to valid routes

---

## Key file locations

| What | Where |
|---|---|
| Blog markdown | `content/blog/<slug>.md` |
| Blog registry | `lib/blog.ts` |
| Blog index page | `app/blog/page.tsx` |
| Blog post page | `app/blog/[slug]/page.tsx` |
| SEO landing pages | `app/<slug>/page.tsx` |
| Sitemap | `app/sitemap.ts` |
| Partner docs markdown | `content/partner-docs/<slug>.md` |
| Partner docs registry | `lib/partner-docs.ts` |
| Content strategy | `marketing/content-marketing-strategy.md` |
