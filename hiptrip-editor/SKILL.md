---
name: hiptrip-editor
description: Recipes for acting as a HipTrip editor agent — writing and publishing curated trips from scratch, and doing agent-driven hip place curation (search nearby → analyze reviews → score and save HipPlaces). Use whenever performing editorial work on HipTrip trips or hip places autonomously.
---

# HipTrip Editor Agent

All editor actions go through `/api/editor/agent/*`. These routes use a shared secret for auth — no session cookie needed.

## Setup

```bash
BASE="https://www.yourhiptrip.com"
SECRET=$(grep EDITOR_AGENT_SECRET ~/projects/hip-trip-marketing-site/.env.local | cut -d= -f2 | tr -d '"')
```

For a preview deployment, replace `$BASE` with the Vercel preview URL.

For local dev (after `nextdev start`):
```bash
BASE="http://localhost:3000"
# Use the worktree's .env.local, not the main repo's
SECRET=$(grep EDITOR_AGENT_SECRET ~/projects/hip-trip-marketing-site/.claude/worktrees/agentic-claude-code/.env.local | cut -d= -f2 | tr -d '"')
```

**If `EDITOR_AGENT_SECRET` is not yet in `.env.local`**, generate and add it:
```bash
SECRET=$(openssl rand -hex 32)
echo "EDITOR_AGENT_SECRET=\"$SECRET\"" >> ~/projects/hip-trip-marketing-site/.env.local
# Then add it to Vercel:
vercel env add EDITOR_AGENT_SECRET --cwd ~/projects/hip-trip-marketing-site
```

---

## Full editorial workflow

**Recommended order**: find gaps → write trips → curate HipPlaces → cover image → publish.

HipPlaces must be curated before publishing — users who generate itineraries for a destination get curated spots surfaced if HipPlaces are already in the DB.

### Step 1 — Find what's already covered

```bash
curl -s "$BASE/api/editor/agent/trips" \
  -H "x-editor-agent-secret: $SECRET" | \
  jq '.trips[] | .location' | sort | uniq -c | sort -rn | head -20
```

Use this to identify underrepresented destinations. Pick destinations that are genuinely hip and not already saturated.

### Step 2 — Write trips from scratch

You write the trip content using your own knowledge — do not use the `generate/` endpoints for this. Use your cultural judgment to craft compelling, accurate trip descriptions.

Trip POST body shape:

```json
{
  "title": "Pepper Coast Weekend: Kampot, Kep & Rabbit Island",
  "slug": "pepper-coast-weekend-kampot-kep-rabbit-island",
  "description": "A relaxed long weekend linking Kampot's riverfront cafés, Kep's crab markets and a night on laid-back Rabbit Island.",
  "content": "Kampot moves at the speed of a river town that knows it doesn't need to try harder...\n\n(3-5 editorial paragraphs about atmosphere, character, what makes it worth going — NOT a day-by-day itinerary. This is a tease that drives users to generate their own day-by-day plan. Plain prose only — no markdown headers, no ## Day N structure.)",
  "tripType": "coastal food and culture escape",
  "location": "Kampot",
  "country": "Cambodia",
  "difficulty": "easy",
  "durationDays": 3,
  "bestSeason": "November to April",
  "highlights": ["Durian shakes on the Kampot riverfront", "Crab market at Kep Beach", "Night on Rabbit Island"],
  "tripBalance": {
    "hiking": 0,
    "biking": 1,
    "beach": 2,
    "historical": 0,
    "cultural": 2,
    "cafes": 2,
    "bars": 1
  }
}
```

`tripBalance` values are each **0–3** (0=none, 1=a little, 2=some, 3=a lot). Keys: `hiking`, `biking`, `beach`, `historical`, `cultural`, `cafes`, `bars`. These pre-populate the itinerary generator sliders when a user clicks "Create Your Itinerary."

`difficulty` is one of: `easy`, `moderate`, `challenging`.

`content` is rendered as **plain prose paragraphs** (split on `\n\n`) under the heading "The Experience." It is a **marketing tease**, not a day-by-day itinerary — the real itinerary is AI-generated per user in `/dashboard/generate`. Keep it to 3–5 paragraphs: atmosphere, character, what makes it worth visiting, who it suits. No markdown headers, no `## Day N` structure.

Save as a draft (always `isPublished: false` on create):

```bash
TRIP_ID=$(curl -s -X POST "$BASE/api/editor/agent/trips" \
  -H "x-editor-agent-secret: $SECRET" \
  -H "Content-Type: application/json" \
  --data-binary "$TRIP_JSON" | jq -r '.id')
echo "Created: $TRIP_ID"
```

**Shell tip**: for multi-line JSON, write to a temp file and use `--data-binary @/tmp/trip.json` to avoid shell quoting issues with newlines and special characters.

### Step 3 — Curate HipPlaces for the destination

See "Agent-driven hip curation" section below. Do this before publishing — it's what makes itineraries feel local rather than generic.

**Target 15–20 HipPlaces per destination.** The itinerary generator queries by city/country and takes the top 15 by hip score. With fewer than 12 there isn't enough variety to fill a multi-day trip without repeating categories. Cover at least: Coffee Shop, Dinner Spots, Street Food, Bar / Nightlife, Museum/gallery, Bakery.

### Step 4 — Cover image + publish

```bash
# Generate cover image (~10-20 seconds)
curl -s -X POST "$BASE/api/editor/agent/trips/$TRIP_ID/cover-image" \
  -H "x-editor-agent-secret: $SECRET" | jq '.url'

# Publish
curl -s -X POST "$BASE/api/editor/agent/trips/$TRIP_ID/publish" \
  -H "x-editor-agent-secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"published": true}' | jq
```

---

## Agent-driven hip curation

This is the primary workflow for discovering hip places. The app's built-in scorer uses gpt-5.4 automatically — you do better by reading the actual reviews and applying cultural judgment. The app provides place data; you decide what's hip.

### How to score a place

Use these six dimensions (1–10 each). hipScore = round((vibe×0.20 + authenticity×0.20 + scene×0.15 + visual×0.15 + uniqueness×0.20 + value×0.10) × 10) — ranges 0–100.

Example: vibe=9, auth=10, scene=8, visual=7, unique=9, value=9 → round((9×.20 + 10×.20 + 8×.15 + 7×.15 + 9×.20 + 9×.10) × 10) = round(8.75 × 10) = **88**.

| Dimension | What to evaluate |
|---|---|
| **vibe** (×2) | Atmosphere, energy, aesthetic. Does it feel alive and interesting? |
| **authenticity** (×2) | Local character vs tourist trap. Do locals go here? Is it real? |
| **scene** (×1.5) | Social energy. Is there a community around this place? |
| **visual** (×1.5) | Photo-worthy, visually distinctive. Would a traveler post this? |
| **uniqueness** (×2) | Hard to find elsewhere. Is this singular or generic? |
| **value** (×1) | Worth the time/money. Does it deliver? |

**Strong hip signals**: low price level + high review count, local-language reviews, indie/family-owned, off the main tourist drag, regulars mentioned, creative or craft focus, neighborhood institution.

**Anti-hip signals**: chain/franchise, English-only menu, located in a shopping mall or resort, primarily 5-star reviews from tourists, TripAdvisor top-10 positioning, generic Google description.

**High review count ≠ auto-reject.** A place with 10k+ reviews can still be genuinely hip if it earned those reviews through singular quality rather than mass tourism positioning (e.g. Baan Dam Museum — 13k reviews because it is literally unique in the world, not because it's a generic attraction). Apply judgment: is the volume because the place is *irreplaceable*, or because it's *convenient*?

### Search for places

Results are ranked by **distance from the search center**, not popularity — so the `location` string and `radiusMeters` you pick directly control what surfaces. Geocoding resolves neighborhood names to genuinely distinct coordinates (confirmed: "Bywater, New Orleans" and "Faubourg Marigny, New Orleans" geocode to different points a few hundred meters apart, not the city centroid) — use that.

- **City-wide first pass**: `radiusMeters: 3000–5000` from `"<City>, <Country>"`. Fine for an initial sweep, but a city-center search will still favor whatever's closest to the center — it won't surface outer neighborhoods on its own.
- **Neighborhood-targeted pass** (do this for any city with distinct hip neighborhoods — most cities worth curating have them): `radiusMeters: 1500–2500`, and set `location` to the neighborhood itself, e.g. `"Bywater, New Orleans, Louisiana, USA"` rather than just `"New Orleans, Louisiana, USA"`. Run one pass per neighborhood per category. This is what actually surfaces local, non-famous spots instead of the same handful of city-wide landmarks appearing in every category.
- If a place you know belongs in the destination doesn't appear, **widen to 10000 and search again** — don't flag it as a gap and stop. Resolve it.

```bash
curl -s -X POST "$BASE/api/editor/agent/search/nearby" \
  -H "x-editor-agent-secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "Kampot, Cambodia",
    "category": "Coffee Shop",
    "radiusMeters": 3000,
    "maxResults": 10
  }' | jq '.places[] | {name, googleRating, ratingCount, priceLevel, editorialSummary}'
```

For a neighborhood pass, same call with a narrower radius and the neighborhood in `location`:

```bash
curl -s -X POST "$BASE/api/editor/agent/search/nearby" \
  -H "x-editor-agent-secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "location": "Bywater, New Orleans, Louisiana, USA",
    "category": "Coffee Shop",
    "radiusMeters": 2000,
    "maxResults": 10
  }' | jq '.places[] | {name, address, googleRating, ratingCount, priceLevel}'
```

Valid `category` values: Coffee Shop, Dinner Spots, Bar / Nightlife, Brunch, Cocktail Bar, Wine Bar, Bakery, Street Food, Shopping, Museum, Hotel, Spa & Wellness.

Each place in the response includes: `googlePlaceId`, `name`, `address`, `googleRating`, `ratingCount`, `editorialSummary`, `priceLevel`, `types`, `reviews[]` (text + rating + relativeTime).

**Read the reviews carefully** — they contain the signal you need to judge authenticity and vibe.

### Save your curation decisions

For each place you decide is hip (target score ≥70), POST it with your analysis:

```bash
curl -s -X POST "$BASE/api/editor/agent/hip-places" \
  -H "x-editor-agent-secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{
    "googlePlaceId": "ChIJ...",
    "name": "Sinouk Coffee",
    "address": "Pakse, Laos",
    "latitude": 15.12,
    "longitude": 105.80,
    "city": "Pakse",
    "country": "Laos",
    "location": "Pakse, Laos",
    "tags": ["coffee", "local-roaster", "authentic"],
    "notes": "Laos largest specialty roaster. Regulars treat it as a living room. Coffee grown on their own Bolaven plantation — you can taste the terroir.",
    "aiHipScore": {
      "categories": {
        "vibe": 9,
        "authenticity": 10,
        "scene": 8,
        "visual": 7,
        "uniqueness": 9,
        "value": 9
      },
      "hipScore": 88,
      "reasoning": {
        "vibe": "Relaxed and genuine — ceiling fans, wooden furniture, no Instagram trappings",
        "authenticity": "Family-owned roastery with direct farm connection. Locals pack it every morning",
        "scene": "Strong regular crowd, staff know customers by name",
        "visual": "Simple but characterful — burlap sacks, roasting equipment on display",
        "uniqueness": "The origin story (Bolaven highlands, family farms) is genuinely singular",
        "value": "Best coffee in Laos at local prices",
        "summary": "The kind of place that makes a destination feel worth visiting — authentic, connected to its land, beloved by locals"
      },
      "model": "claude-sonnet-4-6",
      "generatedAt": "2026-05-02T12:00:00Z"
    }
  }' | jq
```

`location` (string) is used to find or create the associated `Destination` record automatically. Use it instead of `destinationId` when you don't have the ID.

### List what you've curated

```bash
curl -s "$BASE/api/editor/agent/hip-places?location=Kampot" \
  -H "x-editor-agent-secret: $SECRET" | \
  jq '.places[] | {name, "hipScore": .aiHipScore.hipScore, tags}'
```

### Remove a bad pick

```bash
curl -s -X DELETE "$BASE/api/editor/agent/hip-places/$PLACE_ID" \
  -H "x-editor-agent-secret: $SECRET" | jq
```

### Curation loop for a destination

Cover the key categories: Coffee Shop, Dinner Spots, Bar / Nightlife, Bakery, Street Food, Museum. **One destination covers all trips at that location** — curating Kampot once applies to all Kampot trips.

---

## Trip CRUD

### List trips

```bash
# All trips
curl -s "$BASE/api/editor/agent/trips" \
  -H "x-editor-agent-secret: $SECRET" | jq '.trips[] | {id, title, location, isPublished}'

# Only drafts
curl -s "$BASE/api/editor/agent/trips?status=draft" \
  -H "x-editor-agent-secret: $SECRET" | jq '.trips[] | {id, title, location}'

# Only published
curl -s "$BASE/api/editor/agent/trips?status=published" \
  -H "x-editor-agent-secret: $SECRET" | jq '.trips | length'
```

Response fields: `id`, `title`, `slug`, `location`, `country`, `tripType`, `difficulty`, `durationDays`, `bestSeason`, `isPublished`, `coverImage` (null if not generated), `createdAt`.

### Get a single trip

```bash
curl -s "$BASE/api/editor/agent/trips/$TRIP_ID" \
  -H "x-editor-agent-secret: $SECRET" | jq
```

Returns full trip including parsed `highlights[]` and `tripBalance{}`.

### Update a trip

PATCH with only the fields you want to change:

```bash
curl -s -X PATCH "$BASE/api/editor/agent/trips/$TRIP_ID" \
  -H "x-editor-agent-secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"description": "Updated description here"}' | jq
```

### Delete a trip

```bash
curl -s -X DELETE "$BASE/api/editor/agent/trips/$TRIP_ID" \
  -H "x-editor-agent-secret: $SECRET" | jq
```

---

## Decision guidance

**When to publish immediately**: strong location, rich content, all highlights are real place names, tripBalance makes sense, HipPlaces are curated.

**When to save as draft**: highlights are vague or generic, difficulty/duration mismatch, or HipPlaces not yet curated for the destination.

**When to delete**: duplicates of trips already in the DB, obviously wrong place names, slugs that conflict with a better existing trip.

---

## Automated enrich (fallback — use agent curation above when possible)

Runs the full scan → gpt-5.4 score → auto-accept pipeline server-side without your involvement. Use only when speed matters more than curation quality (e.g. bulk backfilling many destinations at once).

**Takes ~2-5 minutes** (scores up to 80 places across 8 categories at 5 concurrent AI calls).

```bash
# Default: 8 categories, 10 results each, threshold 70, radius 5km
curl -s -X POST "$BASE/api/editor/agent/trips/$TRIP_ID/enrich" \
  -H "x-editor-agent-secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' | jq '{destinationName, isNewDestination, totals}'
```

Parameters (all optional):
```json
{
  "categories": ["Coffee Shop", "Bar / Nightlife"],
  "radiusMeters": 5000,
  "maxResultsPerCategory": 10,
  "hipScoreThreshold": 70
}
```

---

## Bulk trip generation (automated — use sparingly)

These endpoints use gpt-5.4 to generate destination ideas and trip content. Prefer writing trips from scratch (Step 2 above) — these are useful for rapid bulk generation when you need many destinations quickly.

### Generate destination ideas from a seed theme

```bash
curl -s -X POST "$BASE/api/editor/agent/generate/categories" \
  -H "x-editor-agent-secret: $SECRET" \
  -H "Content-Type: application/json" \
  -d '{"seed": "off-the-beaten-path Southeast Asia"}' | jq '.categories[] | {name, location, country}'
```

Response: `{ categories: [{ name, description, location, country, bestSeason }] }`

### Generate trip variants for a destination

```bash
# Write category to a temp file to avoid shell quoting issues
echo '{"name":"Kampot","location":"Kampot","country":"Cambodia","bestSeason":"Nov-Apr"}' > /tmp/cat.json

curl -s -X POST "$BASE/api/editor/agent/generate/trips" \
  -H "x-editor-agent-secret: $SECRET" \
  -H "Content-Type: application/json" \
  --data-binary "{\"category\": $(cat /tmp/cat.json)}" | jq '.trips[] | {title, durationDays, difficulty}'
```

Response: `{ trips: [{ title, slug, description, content, tripType, location, country, difficulty, durationDays, bestSeason, highlights[], tripBalance{} }] }`

Save generated trips to a file before processing — shell variables with multi-line JSON cause parse errors:

```bash
curl -s -X POST "$BASE/api/editor/agent/generate/trips" ... > /tmp/trips.json
jq -c '.trips[0]' /tmp/trips.json > /tmp/trip0.json
curl -s -X POST "$BASE/api/editor/agent/trips" \
  -H "x-editor-agent-secret: $SECRET" \
  -H "Content-Type: application/json" \
  --data-binary @/tmp/trip0.json | jq '{id, slug}'
```
