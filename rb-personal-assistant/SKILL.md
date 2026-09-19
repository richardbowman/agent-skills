---
name: rb-personal-assistant
description: Personal assistant skill for Gmail triage, drafting responses, scanning newsletters for interests, and preparing trip reports. Owns the full scheduled Gmail inbox-triage procedure (including the Obsidian "Email Action Items" Base). Use when managing email or automating travel/dev workflows.
---

# RB Personal Assistant

## Harness portability

Use the active harness's Gmail connector, secure-secret request, vault/file tools, and scheduler equivalents. If a required connector is unavailable, prepare a draft/report and identify the missing capability; never bypass the confirmation rules for sending email or changing external state. Existing `Claude Sessions` vault headings are retained as storage schema, not as a harness requirement.

This skill lets an AI assistant (Claude or Gemini) act as a proactive assistant for Rick's Gmail inbox and professional workflows. It is the single source of truth for the inbox-triage procedure — the scheduled cron job simply invokes this skill, so keep the full logic here rather than duplicating it in the cron prompt.

---

## Gmail Inbox Triage — Full Procedure

Run this whenever asked to triage the inbox, including scheduled/unattended runs. Use the `gws` CLI (already on PATH). Work the steps in order.

**Key constants**
- **Vault paths:** every vault path below is vault-relative; the runtime supplies the vault root. Never hard-code one.
- **Jarvis archive label:** `Label_9220311120338883160` — to archive, add this label AND remove `INBOX` in the same `modify` call.
- **Inbox scan query:** `gws gmail +triage --query 'is:unread label:INBOX' --max 60`
- **Context notes:** `Jarvis Summaries/triage-context.md`
- **Action Items folder:** `Jarvis Summaries/Action Items/`
- **Action Items Base** (already exists — never recreate): `Jarvis Summaries/Email Action Items.base`
- **Summaries folder:** `Jarvis Summaries/`
- **Daily notes:** `Daily/<YYYY-MM-DD>.md`
- **gws caveat:** label parameters must be plain strings, not arrays — e.g. `addLabelIds: "Label_9220311120338883160"`, `removeLabelIds: "INBOX"`.
- **zsh caveat:** this environment's shell is zsh, not bash. `for x in $VAR; do` does NOT word-split unquoted variables in zsh (unlike bash) — a multi-id loop built that way silently runs once with the whole string as `$x`. Use a zsh array instead: `IDS=(id1 id2 id3); for id in "${IDS[@]}"; do ...`. Also, `status` is a zsh read-only builtin variable — never name a shell variable `status` (use `st` or similar) or assignment fails.

### STEP 0 — Read context notes
Read the context-notes file. These are notes from Rick about things he has already handled or wants treated differently this run — factor them into every decision below. After the run, remove any notes you acted on (edit the Pending Notes section). If a note should become a permanent rule, add it to `references/preferences.md` instead of leaving it in the context file.

### STEP 0b — Deduplicate against prior runs AND the Action Items Base
1. `ls "Jarvis Summaries/Triage-$(date +%Y-%m-%d)"*.md 2>/dev/null` (relative to vault root) — if any exist, read them and extract every subject/sender already under **Action Required** and every newsletter already under **Newsletter Highlights**.
2. `ls "Jarvis Summaries/Action Items/"` and, for any email you are about to flag, check for an existing tracking note by Gmail id: `grep -rl "gmail_id: <ID>" "Jarvis Summaries/Action Items/"`.

If something was already reported today, or already has an open action-item note, do not repeat it in the summary and do not create a duplicate note — only update the existing note (STEP 5b), unless there is genuinely new information (a reply, an update, a different email on the same topic).

### STEP 0c — Process pending Base actions
The Action Items Base has an `archive` checkbox column (Rick ticks it in Obsidian). Before scanning the inbox, sweep for pending actions:

1. `grep -l "^archive: true" "Jarvis Summaries/Action Items/"*.md` (also match `archive: true` without the caret in case of indentation differences).
2. For each match, read the note's frontmatter. Skip it if `status` is already `Done` or `Dismissed` (already processed on a prior run — nothing to do).
3. Otherwise archive the underlying email: `gws gmail users messages modify --params '{"userId": "me", "id": "<gmail_id>", "addLabelIds": "Label_9220311120338883160", "removeLabelIds": "INBOX"}'`.
4. On success, update the note's frontmatter: set `status: Dismissed` and `last_run` to now. Leave `archive: true` in place as the record of the action — do not uncheck it.
5. On failure (e.g. message already deleted), leave `status` as-is, do not retry endlessly, and note the failure under a **Errors** line in this run's triage summary (STEP 7) so Rick sees it.

This step is the only thing that closes the loop on the checkbox — checking it in Obsidian does nothing to the actual Gmail message until the next scheduled triage run picks it up (every 6h, 07:00-22:00).

### STEP 0d — Age out stale tracked items

The Action Items Base only ever grows unless something actively closes a note — STEP 0c requires Rick to notice and check a box, which doesn't scale (by 2026-09-18 it had reached 274 notes, 253 still `Open`, some from six weeks prior). This step runs every triage and closes notes automatically wherever it's safe to infer the item is no longer live, so the Base stays a reliable list of things that actually still need Rick's attention.

1. **List every `Open` note's `gmail_id`** in `Jarvis Summaries/Action Items/`.
2. **Pull the current full inbox id set** (not just unread): `gws gmail users messages list --params '{"userId": "me", "q": "in:inbox", "maxResults": 500}'`. If the response includes `nextPageToken`, repeat with `pageToken` set until it stops, so the full inbox is covered (it routinely exceeds 500).
3. **Close any `Open` note whose `gmail_id` is no longer in that set.** If the underlying email isn't in the inbox at all anymore, Rick (or something else) already dealt with it outside this flow — the note is orphaned. Set `status: Dismissed`, leave `archive: false` (nothing left to archive), and append a line to the note body: `**Auto-closed <today's date>:** underlying email no longer in inbox — resolved outside the triage flow.` Do not touch notes whose email is still sitting in the inbox; those still need a human look.
4. **Age out category-specific noise for notes still in the inbox:**
   - **`CI/CD`:** if `first_seen` is more than 5 days ago and the note has never been updated to `In Progress`/`Done` by Rick, treat it as stale (CI failures are always superseded by the next run or a direct look at the repo — a week-old tracking note has no informational value). Archive the email (Jarvis label) and set `status: Dismissed`, noting `**Auto-closed <date>:** CI/CD notice unresolved after 5+ days, treated as stale — check the repo directly if still relevant.`
   - **`Appointment`:** if `due_date` (or `email_date` when no `due_date`) is in the past, the appointment has already happened or passed — archive the email and dismiss with `**Auto-closed <date>:** appointment date has passed.`
   - **Shipping/delivery notices filed under `Other`** (subject matches "package"/"delivery"/"shipped"/"on the way"): if more than 10 days old, archive and dismiss with `**Auto-closed <date>:** shipping window has elapsed.` (Better: per STEP 5b, file these as already-closed at creation time so this never has to catch one — see note there.)
   - Leave `Billing`, `Security`, `Compliance`, `Invoice`, `Benefits`, `Opportunity`, `Solar`, `SEO`, and `Account` alone here — those categories can carry real money, deadlines, or judgment calls, so only step 3's inbox-presence check applies to them; never age them out on a timer.
5. **Report counts, not a per-item list**, in the triage summary (STEP 7) — e.g. `Housekeeping: closed 14 stale notes (9 no longer in inbox, 4 aged CI/CD, 1 past-due appointment).` A full itemized list isn't useful signal; the count confirms the sweep ran.

### STEP 1 — Scan unread messages
Run the inbox scan query above. (Note: plain `gws gmail +triage` with no query defaults to `is:unread` across the whole mailbox, capped at 20 — it misses the real inbox backlog because already-archived-but-still-unread mail crowds out true inbox items. Always pass the explicit `label:INBOX` query so this scans the actual inbox.)

### STEP 2 — Archive routine noise
Archive (jarvis label + remove INBOX): TestFlight / GitHub / Vercel successes, Experian promos, TaxSlayer, Google Security Alerts for known accounts. Also archive newsletters after summarizing their highlights (STEP 4) — do not leave them in the inbox.

### STEP 3 — Building / condo notices
Move Condominium Association / building emails to the **Home** label.

### STEP 4 — Newsletters
Scan newsletters (WBEZ, Block Club, City Cast, etc.) for snippets matching Rick's interests: smoked meats, bread, cycling, home automation, Linux, SW Michigan local, Costa Rica / Portugal travel (full interest map in `references/preferences.md`). Summarize any hits, then archive the newsletter (jarvis label). SKIP any newsletter already summarized today (STEP 0b) — just archive it silently.

### STEP 5 — Flag Action Required
Flag: invoices from priority contacts, production / billing / security alerts, compliance / attestation deadlines, appointment prep, and paid opportunities. Skip anything the context notes say Rick already handled. SKIP anything already reported today or already tracked by an open action-item note (STEP 0b), unless there is genuinely new information. Pure shipping / tracking notifications ("your order has shipped") are reported once, then archived — file their tracking note as **already closed** (`status: Dismissed`, `archive: true`) at creation time in STEP 5b rather than `Open`, since there's no follow-up action for a shipping notice to wait on. Leaving these `Open` is exactly the kind of note STEP 0d has to clean up later for no reason.

### STEP 5b — Maintain the Action Items Base
For each item flagged in STEP 5, ensure it is tracked as a note in the Action Items folder so it appears in the **Email Action Items** Base. The Base file already exists — do NOT recreate it.

- **Dedup on `gmail_id`** (STEP 0b). If a note with that id exists: only update `last_run` (and `last_seen`) to the current run — do NOT overwrite `status` (Rick manages it manually) and do NOT duplicate. If the existing note's status is `Done` or `Dismissed`, leave it closed; do not reopen or re-flag it.
- **If no note exists, create one.** Filename: `<Sender> - <short subject>.md` (strip filename-invalid characters: `/ \ :` etc.). Frontmatter schema:

```yaml
---
type: email-action
status: Open            # Open | In Progress | Done | Dismissed  (Rick edits this in Obsidian)
archive: false          # Rick checks this box in the Base to archive the email + close the item (STEP 0c)
priority: High          # High | Medium | Low
priority_rank: 1        # 1=High, 2=Medium, 3=Low  (drives sort order)
category: Billing       # Billing | Invoice | Security | Compliance | CI/CD | Account | Benefits | Appointment | Opportunity | Solar | SEO | Other
sender: "Vercel"
subject: "..."
email_date: YYYY-MM-DD  # date the email was received
due_date:               # optional; only if the email states a due date
gmail_id: <hex id from gws>
gmail_link: https://mail.google.com/mail/u/0/#all/<hex id>
first_seen: YYYY-MM-DD  # today
last_run: YYYY-MM-DD-HH-MM
---
```

Body: an H1 `# <Sender> — <subject>`, a 1–2 sentence description of the action needed, and a `**[Open in Gmail](<gmail_link>)**` line. The `gmail_link` hex id is the same hex message/thread id `gws` returns — it is Gmail's web permalink.

- **Assign priority sensibly:** High = money at risk / production down / hard deadline (billing failures, overdue payments, security breaches, compliance attestations); Medium = needs a decision or reply soon (invoices, CI failures, account setup, appointments, paid opportunities); Low = informational but actionable (statements, SEO audits, marketing nudges).

### STEP 6 — Travel hold
Do NOT archive travel emails (Marriott, AC Hotels, UPS, airlines) until the trip is confirmed over. See Travel & Trip Reporting below.

### STEP 7 — Write the triage summary
Write to `Jarvis Summaries/Triage-<YYYY-MM-DD-HH-MM>.md` with sections: **Action Required**, **Newsletter Highlights**, **Archived**, **Housekeeping**. Under Action Required, note that items are also tracked in the [[Jarvis Summaries/Email Action Items.base|Email Action Items]] Base. If STEP 0c processed any checkbox actions, add an **Archived via Base** line listing them, and an **Errors** line for any that failed. Under Housekeeping, report the STEP 0d close-out counts. If nothing new was found, write a brief "No new items since last run" note (STEP 0d housekeeping still runs and gets reported) and stop.

### STEP 8 — Link in the daily note
Add a wikilink to the summary file in `Daily/<YYYY-MM-DD>.md` under a `## Claude Sessions` section (create the section if missing).

> Scheduled/unattended runs: complete STEP 0–8 and stop — no need to post the summary anywhere else.

---

## Travel & Trip Reporting
- **Identify**: Track hotel (Marriott, AC Hotels), flight, and shipping (UPS) emails.
- **Workflow**: (Future) Check the calendar to correlate these into a single "Trip Report".
- **Action**: Do not archive travel receipts / info until the trip has concluded.

## Response Protocol
- **Priority Contacts**: (e.g. HVAC contractor) Draft short, polite responses to invoices or inquiries.
- **Safety**: Never authorize payments or click financial links without explicit confirmation from Rick.

## Creating Gmail Drafts (with or without attachments)

The `gws` CLI cannot handle large payloads as command-line arguments. Use the Python recipe below instead, which decrypts the gws credentials directly and calls the Gmail API.

**Text-only draft:**
```python
import base64, json, subprocess
from email.mime.text import MIMEText

# Get fresh access token
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
key = base64.b64decode(subprocess.run(['security', 'find-generic-password', '-s', 'gws-cli', '-w'], capture_output=True, text=True).stdout.strip())
with open('/Users/rickbowman/.config/gws/credentials.enc', 'rb') as f:
    data = f.read()
creds = json.loads(AESGCM(key).decrypt(data[:12], data[12:], None))
import urllib.request, urllib.parse
token = json.loads(urllib.request.urlopen(urllib.request.Request(
    'https://oauth2.googleapis.com/token',
    data=urllib.parse.urlencode({**creds, 'grant_type': 'refresh_token'}).encode()
)).read())['access_token']

# Build and send draft
msg = MIMEText("body here")
msg['To'] = 'recipient@example.com'
msg['From'] = 'rick@rbcodelabs.com'
msg['Subject'] = 'subject here'
raw = base64.urlsafe_b64encode(msg.as_bytes()).decode()
resp = json.loads(urllib.request.urlopen(urllib.request.Request(
    'https://gmail.googleapis.com/gmail/v1/users/me/drafts',
    data=json.dumps({"message": {"raw": raw}}).encode(),
    headers={'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
)).read())
print("Draft ID:", resp['id'])
```

**With image attachments** — use `MIMEMultipart` instead:
```python
from email.mime.multipart import MIMEMultipart
from email.mime.image import MIMEImage
msg = MIMEMultipart()
# set To/From/Subject, attach MIMEText(body), then:
for path, name in [('/path/to/file.png', 'file.png')]:
    with open(path, 'rb') as f:
        img = MIMEImage(f.read(), name=name)
        img.add_header('Content-Disposition', 'attachment', filename=name)
        msg.attach(img)
# then encode and POST as above
```

**Note:** `cryptography` must be installed (`pip3 install cryptography`). The token from `gws auth export` is not an access token — always refresh via the recipe above.

## Command Reference
- **Scan inbox**: `gws gmail +triage --query 'is:unread label:INBOX' --max 60`
- **Read & Scan**: `gws gmail users messages get --params '{"userId": "me", "id": "ID"}'`
- **Move to Label**: `gws gmail users messages modify --params '{"userId": "me", "id": "ID", "addLabelIds": "LABEL", "removeLabelIds": "INBOX"}'`
- **Archive**: `gws gmail users messages modify --params '{"userId": "me", "id": "ID", "addLabelIds": "Label_9220311120338883160", "removeLabelIds": "INBOX"}'`

## Preferences Reference
See [references/preferences.md](references/preferences.md) for detailed interest mapping and contact rules.
