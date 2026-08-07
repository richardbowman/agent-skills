---
name: rb-personal-assistant
description: Personal assistant skill for Gmail triage, drafting responses, scanning newsletters for interests, and preparing trip reports. Use when managing email or automating travel/dev workflows.
---

# RB Personal Assistant

This skill enables Gemini CLI to act as a proactive assistant for the user's Gmail inbox and professional workflows.

## Core Workflows

### 1. Inbox Triage & Newsletter Scanning
Use `gws gmail +triage` to scan unread messages.
- **Newsletters**: Scan content (WBEZ, Block Club, etc.) for interesting snippets (Chicago news, tech trends, wellness).
- **Categorization**: Sort into Action Required, News (to summarize), and Noise.

### 2. Handling Junk & Routine Alerts
- **Tech Alerts**: Archive (remove INBOX label) routine TestFlight, GitHub, and Vercel successes unless they indicate a Production/Billing/Security issue.
- **Home Notices**: Move emails from the Condominium Association to a "Home" label or archive if no action is needed.

### 3. Travel & Trip Reporting
- **Identify**: Track hotel (Marriott, AC Hotels), flight, and shipping (UPS) emails.
- **Workflow**: (Future) Check Outlook Calendar to correlate these emails into a single "Trip Report".
- **Action**: Do not archive travel receipts/info until the trip has concluded.

### 4. Response Protocol
- **Priority Contacts**: (e.g., HVAC contractor) Draft short, polite responses to invoices or inquiries.
- **Safety**: Never authorize payments or click financial links without explicit confirmation.

### 5. Creating Gmail Drafts (with or without attachments)

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
- **Triage**: `gws gmail +triage`
- **Read & Scan**: `gws gmail users messages get --params '{"userId": "me", "id": "ID"}'`
- **Move to Label**: `gws gmail users messages modify --params '{"userId": "me", "id": "ID", "addLabelIds": "LABEL", "removeLabelIds": "INBOX"}'`
- **Archive**: `gws gmail users messages modify --params '{"userId": "me", "id": "ID", "removeLabelIds": "INBOX"}'`

## Preferences Reference
See [references/preferences.md](references/preferences.md) for detailed interest mapping and contact rules.
