---
name: rb-personal-assistant
description: Personal assistant skill for Gmail triage, drafting responses, scanning newsletters for interests, and preparing trip reports. Owns the full scheduled Gmail inbox-triage procedure (including the Obsidian "Email Action Items" Base). Use when managing email or automating travel/dev workflows.
---

# RB Personal Assistant

This skill lets an AI assistant (Claude or Gemini) act as a proactive assistant for Rick's Gmail inbox and professional workflows. It is the single source of truth for the inbox-triage procedure — the scheduled cron job simply invokes this skill, so keep the full logic here rather than duplicating it in the cron prompt.

---

## Gmail Inbox Triage — Full Procedure

Run this whenever asked to triage the inbox, including scheduled/unattended runs. Use the `gws` CLI (already on PATH). Work the steps in order.

**Key constants**
- **Jarvis archive label:** `Label_9220311120338883160` — to archive, add this label AND remove `INBOX` in the same `modify` call.
- **Inbox scan query:** `gws gmail +triage --query 'is:unread label:INBOX' --max 60`
- **Context notes:** `/Users/rickbowman/Documents/Personal/Jarvis Summaries/triage-context.md`
- **Action Items folder:** `/Users/rickbowman/Documents/Personal/Jarvis Summaries/Action Items/`
- **Action Items Base** (already exists — never recreate): `/Users/rickbowman/Documents/Personal/Jarvis Summaries/Email Action Items.base`
- **Summaries folder:** `/Users/rickbowman/Documents/Personal/Jarvis Summaries/`
- **Daily notes:** `/Users/rickbowman/Documents/Personal/Daily/<YYYY-MM-DD>.md`
- **gws caveat:** label parameters must be plain strings, not arrays — e.g. `addLabelIds: "Label_9220311120338883160"`, `removeLabelIds: "INBOX"`.

### STEP 0 — Read context notes
Read the context-notes file. These are notes from Rick about things he has already handled or wants treated differently this run — factor them into every decision below. After the run, remove any notes you acted on (edit the Pending Notes section). If a note should become a permanent rule, add it to `references/preferences.md` instead of leaving it in the context file.

### STEP 0b — Deduplicate against prior runs AND the Action Items Base
1. `ls "/Users/rickbowman/Documents/Personal/Jarvis Summaries/Triage-$(date +%Y-%m-%d)"*.md 2>/dev/null` — if any exist, read them and extract every subject/sender already under **Action Required** and every newsletter already under **Newsletter Highlights**.
2. `ls "/Users/rickbowman/Documents/Personal/Jarvis Summaries/Action Items/"` and, for any email you are about to flag, check for an existing tracking note by Gmail id: `grep -rl "gmail_id: <ID>" "/Users/rickbowman/Documents/Personal/Jarvis Summaries/Action Items/"`.

If something was already reported today, or already has an open action-item note, do not repeat it in the summary and do not create a duplicate note — only update the existing note (STEP 5b), unless there is genuinely new information (a reply, an update, a different email on the same topic).

### STEP 0c — Process pending Base actions
The Action Items Base has an `archive` checkbox column (Rick ticks it in Obsidian). Before scanning the inbox, sweep for pending actions:

1. `grep -l "^archive: true" "/Users/rickbowman/Documents/Personal/Jarvis Summaries/Action Items/"*.md` (also match `archive: true` without the caret in case of indentation differences).
2. For each match, read the note's frontmatter. Skip it if `status` is already `Done` or `Dismissed` (already processed on a prior run — nothing to do).
3. Otherwise archive the underlying email: `gws gmail users messages modify --params '{"userId": "me", "id": "<gmail_id>", "addLabelIds": "Label_9220311120338883160", "removeLabelIds": "INBOX"}'`.
4. On success, update the note's frontmatter: set `status: Dismissed` and `last_run` to now. Leave `archive: true` in place as the record of the action — do not uncheck it.
5. On failure (e.g. message already deleted), leave `status` as-is, do not retry endlessly, and note the failure under a **Errors** line in this run's triage summary (STEP 7) so Rick sees it.

This step is the only thing that closes the loop on the checkbox — checking it in Obsidian does nothing to the actual Gmail message until the next scheduled triage run picks it up (every 6h, 07:00-22:00).

### STEP 1 — Scan unread messages
Run the inbox scan query above. (Note: plain `gws gmail +triage` with no query defaults to `is:unread` across the whole mailbox, capped at 20 — it misses the real inbox backlog because already-archived-but-still-unread mail crowds out true inbox items. Always pass the explicit `label:INBOX` query so this scans the actual inbox.)

### STEP 2 — Archive routine noise
Archive (jarvis label + remove INBOX): TestFlight / GitHub / Vercel successes, Experian promos, TaxSlayer, Google Security Alerts for known accounts. Also archive newsletters after summarizing their highlights (STEP 4) — do not leave them in the inbox.

### STEP 3 — Building / condo notices
Move Condominium Association / building emails to the **Home** label.

### STEP 4 — Newsletters
Scan newsletters (WBEZ, Block Club, City Cast, etc.) for snippets matching Rick's interests: smoked meats, bread, cycling, home automation, Linux, SW Michigan local, Costa Rica / Portugal travel (full interest map in `references/preferences.md`). Summarize any hits, then archive the newsletter (jarvis label). SKIP any newsletter already summarized today (STEP 0b) — just archive it silently.

### STEP 5 — Flag Action Required
Flag: invoices from priority contacts, production / billing / security alerts, compliance / attestation deadlines, appointment prep, and paid opportunities. Skip anything the context notes say Rick already handled. SKIP anything already reported today or already tracked by an open action-item note (STEP 0b), unless there is genuinely new information. Pure shipping / tracking notifications ("your order has shipped") are reported once, then archived.

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
Write to `/Users/rickbowman/Documents/Personal/Jarvis Summaries/Triage-<YYYY-MM-DD-HH-MM>.md` with sections: **Action Required**, **Newsletter Highlights**, **Archived**. Under Action Required, note that items are also tracked in the [[Jarvis Summaries/Email Action Items.base|Email Action Items]] Base. If STEP 0c processed any checkbox actions, add an **Archived via Base** line listing them, and an **Errors** line for any that failed. If nothing new was found, write a brief "No new items since last run" note and stop.

### STEP 8 — Link in the daily note
Add a wikilink to the summary file in `/Users/rickbowman/Documents/Personal/Daily/<YYYY-MM-DD>.md` under a `## Claude Sessions` section (create the section if missing).

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
