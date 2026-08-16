# roadmap-ship

Ship roadmap items by updating their status in the production database via the admin API.

## Setup

```bash
MAIN_REPO=$HOME/projects/golden-wealth-app
SECRET=$(grep MIGRATION_SECRET $MAIN_REPO/.env.local | cut -d= -f2 | tr -d '"')
DEPLOY=$(cat /tmp/vercel_prod_url.txt 2>/dev/null || echo "https://v0-golden-wealth.vercel.app")
```

## Step 1 — Find item IDs

Query the live roadmap to get current items and their IDs:

```bash
vercel curl /api/roadmap \
  --deployment $DEPLOY \
  --cwd $MAIN_REPO 2>/dev/null | python3 -m json.tool | grep -A3 '"title"'
```

Or pipe to jq for a clean list:

```bash
vercel curl /api/roadmap \
  --deployment $DEPLOY \
  --cwd $MAIN_REPO 2>/dev/null \
  | python3 -c "import sys,json; [print(i['status'], i['id'], i['title']) for i in json.load(sys.stdin)['items']]"
```

## Step 2 — Wait for deploy (if just merged)

```bash
vercel-wait-deploy --cwd $MAIN_REPO
# Updates /tmp/vercel_prod_url.txt on success
DEPLOY=$(cat /tmp/vercel_prod_url.txt)
```

Skip this step if the feature was merged earlier and you just need to update the status.

## Step 3 — Mark items shipped

Single item:

```bash
vercel curl /api/admin/roadmap/<ID> \
  --deployment $DEPLOY \
  --cwd $MAIN_REPO \
  -- --request PATCH \
     --header "Content-Type: application/json" \
     --header "x-migration-secret: $SECRET" \
     --data '{"status":"shipped"}' 2>/dev/null | grep -o '"status":"[^"]*"\|"error":"[^"]*"'
```

Multiple items at once:

```bash
for entry in \
  "<ID1>:Feature one" \
  "<ID2>:Feature two"; do
  id="${entry%%:*}"
  title="${entry##*:}"
  echo -n "=== $title: "
  vercel curl /api/admin/roadmap/$id \
    --deployment $DEPLOY \
    --cwd $MAIN_REPO \
    -- --request PATCH \
       --header "Content-Type: application/json" \
       --header "x-migration-secret: $SECRET" \
       --data '{"status":"shipped"}' 2>/dev/null | grep -o '"status":"[^"]*"\|"error":"[^"]*"'
done
```

## Valid statuses

`idea` → `planned` → `in_progress` → `shipped`

Pass any of these as `"status"` in the PATCH body.

## Auth notes

- The admin endpoint uses `verifyAdmin` from `lib/admin-auth.ts`
- On production, `checkDatabaseHasTables()` returns false for DSQL (Aurora DSQL doesn't expose `information_schema.tables`), so **bootstrap mode is always active** — the migration secret header is accepted but even without it the endpoint allows through
- `vercel curl` bypasses Vercel deployment protection; the `x-migration-secret` header handles app-level auth
- If you get `{"error":"Unauthorized"}`, the new code isn't deployed yet — wait for deploy and retry

## Other fields you can PATCH

```json
{ "title": "New title" }
{ "description": "Updated description" }
{ "published": false }
{ "category": "Financial" }
```
