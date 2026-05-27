# Debug

A structured diagnostic process for production bugs, broken features, and unexpected behavior. Stack-agnostic — the method applies whether it's a Next.js app, a CLI tool, a plugin, or anything else.

**Invoke this skill before reading code or forming hypotheses.**

---

## The failure mode this prevents

Jumping to a theory, writing code to fix the theory, shipping it, and finding out the theory was wrong. The fix is always: gather facts first, hypothesize second, code last.

---

## Step 1 — Understand what the user is actually seeing

Before looking at anything else, ask (or answer from context):

- What is the exact behavior? ("it gets stuck" vs "it returns a 500" vs "it shows a blank screen")
- When did it start? What's the last known-good state?
- Is it reproducible? Every time, or intermittent?
- Is it user-specific, device-specific, or environment-specific?
- **Has the user tried the cheapest fix?** (See Step 2)

Do not open code. Do not form a hypothesis yet.

---

## Step 2 — Try the cheapest fix first

For each symptom type, there is a near-zero-cost thing to try before any diagnosis:

| Symptom | Try first |
|---|---|
| Auth / session / "not logged in" behavior | Sign out and sign back in |
| UI state looks wrong / stale | Hard refresh (Cmd+Shift+R) |
| Works locally, broken in prod | Check env vars are set in prod |
| "It was working yesterday" | Check what deployed since yesterday |
| API returning unexpected data | Check the request in the browser network tab |
| DB query returning wrong results | Check if a migration ran that changed the schema |

**Ask the user to try the relevant cheap fix before proceeding.** If it resolves the issue, root-cause from there — don't skip to complex explanations.

---

## Step 3 — Get the exact error

Do not guess the error type from symptoms. Get the actual message:

- Check runtime logs for the exact exception + stack trace
- Check the browser console for client-side errors
- Check the network tab for the actual HTTP status + response body
- If the app has structured logging, filter for errors in the relevant time window

Record: **error code, error message, file/line if available, request path, timestamp.**

---

## Step 4 — Check what changed

Bugs almost always correlate with a recent change. Before theorizing:

```bash
# What merged recently?
git log --oneline -20

# What changed in the specific file/area?
git log --oneline -- <file-or-directory>

# Any schema changes?
git log --oneline -- prisma/migrations/

# Any config/env changes?
# Check deployment history in whatever CI/CD is in use
```

If the user says "this was working before X," start here — find what X actually changed.

---

## Step 5 — State your hypothesis explicitly

Before writing any code, write down:

1. **What I think is wrong:** (specific, falsifiable)
2. **Why I think that:** (the evidence from steps 1–4 that supports it)
3. **How I would verify it without writing code:** (a log query, a manual test, a DB check)

If you can't state all three, you don't have a hypothesis yet — you have a guess.

**Do not write code to fix a guess.**

---

## Step 6 — Verify the hypothesis

Run the verification from Step 5. Common verification approaches:

- Query the DB or logs directly to confirm or deny the suspected state
- Ask the user to perform a specific action and report what they see
- Add a single temporary log line to confirm a value before changing behavior
- Reproduce the issue in isolation (is it this user? this input? this path?)

If the verification **confirms** the hypothesis → proceed to fix.
If it **contradicts** the hypothesis → return to Step 3 with new information.

---

## Step 7 — Fix narrowly

Once the hypothesis is confirmed:

- Make the **smallest possible change** that addresses the confirmed root cause
- Do not bundle in defensive fixes for *other* hypotheses that weren't verified
- One commit, one problem

If you want to add hardening for edge cases you discovered along the way, do it in a separate PR with a clear explanation.

---

## Step 8 — Verify the fix

After deploying:

- Reproduce the original steps that triggered the bug
- Confirm the error no longer appears in logs
- Ask the user to confirm

---

## Anti-patterns to avoid

- **Hypothesis stacking:** Forming a new hypothesis to explain why the first fix didn't work, then a third to explain the second — without ever verifying any of them
- **Defensive coding as diagnosis:** Adding try/catch, upserts, and fallbacks without knowing why the original code failed
- **Ignoring pushback:** If the user says "this doesn't make sense" or "that was working before," that's evidence against your current hypothesis, not noise to route around
- **Complexity as confidence:** A theory that requires 3 moving parts and a race condition is less likely than a simple explanation — prefer simpler hypotheses first
