# Content Marketing Skill

Use this skill whenever the user asks to write a blog post, add an SEO landing page, audit content, or execute against a content calendar for a web project.

This skill is **project-agnostic**. All project-specific facts (audience, voice, pillars, file paths, content calendar) live in a per-repo config file. The skill carries only the method.

---

## Step 0 — Load the project config (always do this first)

Before writing anything, locate and read the project's content config:

1. Look for `marketing/content-marketing-config.md` in the current repo (fall back to repo root `content-marketing-config.md`).
2. If found, read it. It defines: repo/branch, target audience, voice & tone, the pillar → CTA → feature map, file locations, and a pointer to the full strategy/calendar doc. **Treat its values as authoritative — they override any defaults in this skill.**
3. If **not** found, do not guess project specifics. Offer to scaffold one by interviewing the user (see "Scaffolding a config" below), or ask them to point you at an existing strategy doc.

Everything below is the generic method. Wherever it references a path, a pillar, or a voice rule, use the value from the config.

---

## Workflow: writing a new blog post

### Step 1 — Pick the post
If the user didn't specify, take the next unwritten item from the config's calendar/strategy doc, in queue order.

### Step 2 — Write the markdown body
- File location: the blog markdown path from the config (e.g. `content/blog/<slug>.md`).
- Honor the config's frontmatter convention. Many setups want **body only — no YAML header** — start directly with a `# Title` heading. Confirm against the config.
- Target length: follow the config; absent guidance, 1,200–1,800 words (longer for high-intent/legal posts).
- Structure: intro → 2–4 H2 sections → conclusion with a CTA mention.
- Embed 1–2 internal links naturally to valid routes.
- End with a soft CTA paragraph pointing to the product feature that matches the post's pillar (per the config's pillar → CTA → feature map).

**For recurring news/law roundups** (if the config defines a `news`-style pillar): short intro → one H2 per item with a 2–3 paragraph plain-language explainer → "what this means for you/your family" closing. ~1,000 words is enough; these are news-format, not deep guides.

### Step 3 — Register the post
If the config specifies a blog registry (e.g. `lib/blog.ts`), add an entry matching the existing schema there (slug, title, description, publishedAt, author, tags, pillar, …). Read an existing entry first and mirror its exact shape — do not invent fields.

### Step 4 — Verify
- Read the file back; confirm the frontmatter convention was honored.
- Confirm the slug matches across the filename, the registry entry, and any internal links.

---

## Workflow: adding a landing page

Follow the config's landing-page location and component conventions. Read an existing example page named in the config and mirror its structure (metadata export, nav/footer components, hero, content sections, CTA section, client/server boundary). After creating the page, add it to the sitemap if the config names one.

---

## Workflow: content audit

When asked to audit, check:
1. Every registry entry has a matching markdown file.
2. Every markdown file is registered.
3. `publishedAt` dates aren't unintentionally in the future.
4. Each post's meta description fits the config's length target (commonly 140–160 chars).
5. The sitemap includes all blog posts and landing pages.
6. Internal links in markdown point to valid routes.

---

## Scaffolding a config (when none exists)

Interview the user one section at a time (mirrors the `pm-setup` pattern), then write `marketing/content-marketing-config.md` using the template below. Don't dump all questions at once.

Ask about:
1. **Project basics** — repo path, working branch for content, link to the strategy/calendar doc.
2. **Audience** — who you're writing for, and explicitly who you're *not*.
3. **Voice & tone** — house rules, plus "never use" / "do use" word lists.
4. **Pillars** — each content pillar, its code value (if used in a registry), typical CTA, and the product feature it maps to.
5. **File locations** — blog markdown dir, blog registry, blog index/post pages, SEO landing page dir, sitemap, any partner-docs paths.

### Config template

```markdown
# Content Marketing Config — <Project Name>

## Project context
- **Repo:** `~/projects/<repo>`
- **Content branch:** <branch> (check `git worktree list`)
- **Strategy / calendar doc:** `<path>` — read for the full calendar, keywords, KPIs
- **Target audience:** <who, including who it is NOT>

## Voice & tone
- <house rules>
- **Never use:** <words/phrases>
- **Do use:** <words/phrases>

## Pillars & CTA mapping
| Pillar | Registry value | Typical CTA | Maps to feature |
|---|---|---|---|
| … | … | … | … |

## File locations
| What | Where |
|---|---|
| Blog markdown | `content/blog/<slug>.md` |
| Blog registry | `lib/blog.ts` |
| Blog index page | `app/blog/page.tsx` |
| Blog post page | `app/blog/[slug]/page.tsx` |
| SEO landing pages | `app/<slug>/page.tsx` |
| Sitemap | `app/sitemap.ts` |
| Strategy / calendar | `marketing/content-marketing-strategy.md` |

## Frontmatter convention
- <e.g. body only, no YAML; or list required frontmatter fields>
```
