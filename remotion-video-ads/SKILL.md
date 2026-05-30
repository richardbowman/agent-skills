# Remotion Video Ads

This skill covers three distinct production patterns — check which one applies before proceeding:

| Pattern | Project | TTS | Video | When to use |
|---|---|---|---|---|
| **A — Scripted narration** | Golden Wealth (old) | OpenAI TTS + Whisper | Animated UI mockups | Script drives timing; scenes cut on word boundaries |
| **B — Destination video ads** | HipTrip | ElevenLabs (George) + ElevenLabs Sound Generation | AI video (Veo 2) as full-bleed backgrounds | Multi-clip cinematic ads, no Whisper needed |
| **C — Concept campaign ads** | Golden Wealth (current) | ElevenLabs (George) + ElevenLabs Sound Generation | Veo 2 lifestyle clips OR pure motion typography | 3-act emotional story ads, multiple concepts A/B tested |

---

# Pattern C — Golden Wealth Concept Campaign Ads

**Repo:** `~/projects/golden-wealth-app`
**Branch:** `feat/video-ads-three-concepts`
**Compositions:** `remotion/AdGW_Fear.tsx`, `remotion/AdGW_Gift.tsx`, `remotion/AdGW_Contrast.tsx`
**Brand constants:** `remotion/brand.ts` ← ALWAYS import from here, never hardcode URL/name

Three 9:16 ads (1080×1920), each testing a different emotional angle:

| Ad | Hook | Act 2 | Act 3 |
|---|---|---|---|
| **Fear** | "Your family will know where to find everything. Right?" over Veo stressed-woman-at-desk clip | Full-width vault rows animate in (4 estate items + family access) | Dark navy CTA, George narration |
| **Gift** | "You've spent 30 years building it." over Veo warm-family clip | Dark warm bg, invite-a-family-member UI card with typewriter email + success notification | Amber CTA, George narration |
| **Contrast** | Pure motion typography, no video | Two columns build: chaos (left, coral) vs. solution (right, gold) | GW logo + "Start free" hard cut |

---

## C1 — Brand constants (mandatory)

**Every composition and every generation script must import from `remotion/brand.ts`.**
Never hardcode the URL, brand name, or CTA text.

```ts
// remotion/brand.ts
export const BRAND = {
  url:       'live-golden.com',
  urlSpoken: 'live dash golden dot com',  // for ElevenLabs TTS
  name:      'Golden Wealth',
  ctaText:   'Start free',
  ctaButton: 'Start free — live-golden.com',
}
```

---

## C2 — Quality workflow (MANDATORY — do not skip)

**Before declaring any ad done, run the check script:**

```bash
cd ~/projects/golden-wealth-app
pnpm remotion:check
```

This renders 9 stills (3 per composition) and opens them. Review against this checklist:
- [ ] URL shows `live-golden.com` (not `golden.com` or anything else)
- [ ] Act 1: text readable, sized for 1080×1920 canvas
- [ ] Act 2: elements fill the canvas (not tiny/centered app-UI-sized components)
- [ ] Act 3: CTA button visible, URL present
- [ ] No empty/blank frames

**Before generating narration, always dry-run first:**

```bash
ELEVEN_KEY=$(grep "^ELEVENLABS_API_KEY=" ~/projects/hip-trip-marketing-site/.env.local | cut -d= -f2-)
cd ~/projects/golden-wealth-app
ELEVENLABS_API_KEY="$ELEVEN_KEY" npx tsx remotion/scripts/generate-gw-narration.ts --dry-run
```

Review every line of spoken text. Confirm URL is spoken as "live dash golden dot com". Only then generate for real.

---

## C3 — Asset generation

API keys live in `~/projects/hip-trip-marketing-site/.env.local` (not in the GW repo).
Always export them before running generation scripts:

```bash
ELEVEN_KEY=$(grep "^ELEVENLABS_API_KEY=" ~/projects/hip-trip-marketing-site/.env.local | cut -d= -f2-)
GEMINI_KEY=$(grep "^GEMINI_API_KEY=" ~/projects/hip-trip-marketing-site/.env.local | cut -d= -f2-)
```

**Veo clips** (Fear and Gift only — Contrast has no video):
```bash
cd ~/projects/golden-wealth-app
GEMINI_API_KEY="$GEMINI_KEY" npx tsx remotion/scripts/generate-gw-clips.ts
# Output: public/gw-clips/fear/clip-01.mp4, public/gw-clips/gift/clip-01.mp4
# ~45s each, Veo 2, H.264 web-optimized
```

**Narration** (Fear and Gift — Contrast has no narration):
```bash
ELEVENLABS_API_KEY="$ELEVEN_KEY" npx tsx remotion/scripts/generate-gw-narration.ts --dry-run
# Review text, then:
ELEVENLABS_API_KEY="$ELEVEN_KEY" npx tsx remotion/scripts/generate-gw-narration.ts
# Output: public/gw-narration/fear.mp3, public/gw-narration/gift.mp3
```

**Music** (all three ads):
```bash
ELEVENLABS_API_KEY="$ELEVEN_KEY" npx tsx remotion/scripts/generate-gw-music.ts
# Output: public/gw-music/fear-music.mp3, gift-music.mp3, contrast-music.mp3
```

⚠️ Assets are gitignored. They live in `public/` (root), not `remotion/public/`. If the studio shows 404s, check that assets are in `public/gw-clips/`, `public/gw-narration/`, `public/gw-music/`.

---

## C4 — Running the studio

```bash
cd ~/projects/golden-wealth-app
# Start on port 3007 (avoids conflict with Next.js dev on 3000)
npx remotion studio remotion/index.ts --port 3007
```

Or via package script: `pnpm remotion` (also port 3007).

If you get a 404 on static assets, the issue is almost always that assets are in `remotion/public/` instead of the root `public/`. Move them.

If you get `MediaPlaybackError`, the Veo clips need web-optimization:
```bash
/opt/homebrew/bin/ffmpeg -y -i input.mp4 -c:v libx264 -profile:v baseline -level 3.1 \
  -pix_fmt yuv420p -movflags +faststart -crf 23 -an output.mp4
```

---

## C5 — Rendering to MP4

```bash
cd ~/projects/golden-wealth-app
pnpm render:gw-fear      # → remotion/out/gw-fear.mp4
pnpm render:gw-gift      # → remotion/out/gw-gift.mp4
pnpm render:gw-contrast  # → remotion/out/gw-contrast.mp4
```

---

## C6 — Key lessons from production

| Lesson | Detail |
|---|---|
| **brand.ts is mandatory** | URL was hardcoded as `golden.com` in 4 places AND in the spoken narration. Always import from `remotion/brand.ts`. |
| **Dry-run narration first** | Narration said wrong URL out loud. `--dry-run` flag prints text before calling ElevenLabs. |
| **Music must start at frame 0** | First build had music only in Act 3. Silent for 13s. `<Audio>` goes at composition level, not inside `<Sequence from={390}>`. |
| **App UI components are too small** | GW card components (250px wide) at `scale(0.68)` on 1080×1920 canvas = invisible. Build purpose-built video UI at video scale (56px+ fonts, full-width rows). |
| **Two-column layouts need short items** | At 56px font, column width ~450px allows ~16 chars per line. Use `whiteSpace: 'nowrap'` and keep items to max 13 chars or they collide. |
| **Veo outputs need faststart** | Veo clips have moov atom at end → browser can't stream them. Re-encode with `-movflags +faststart`. |
| **Assets in root public/, not remotion/public/** | Remotion serves from root `public/` by default. Assets must be there, not nested in `remotion/public/`. |
| **pnpm remotion:check before done** | Run it. Open the stills. Check the checklist. Every time. |

---

# Pattern B — HipTrip Destination Video Ads

AI-generated video backgrounds (Veo 3) + ElevenLabs narration + ElevenLabs ambient music bed. One 24-second 9:16 ad per curated trip destination.

Reference composition: `remotion/src/compositions/AdDestination.tsx`
Reference data: `remotion/src/destinations.ts`
Full format spec: Obsidian → `Project & Hobbies/Tech/HipTrip/HipTrip - Destination Video Ad Format`

---

## B1 — Composition structure

Three acts with crossfading Veo clips as full-bleed backgrounds:

```
Act 1 (0–150f, 0–5s):   Hook — tagline appears at frame 0, destination name rises ~1.2s later
Act 2 (150–360f, 5–12s): Itinerary — rotating activities one at a time, video stays visible
Act 3 (360–720f, 12–24s): CTA — dark scrim, George narration, music ducks
```

**Critical: `OffthreadVideo` must always be `muted`. Audio lives in separate `<Audio>` components.**

```tsx
// Video layer — always muted
<Sequence from={CLIP2_START} durationInFrames={CLIP2_DUR}>
  <OffthreadVideo src={src2} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
</Sequence>

// Audio for clip 2 — capped at actual clip duration (240f = 8s × 30fps) to avoid click
<Sequence from={CLIP2_START} durationInFrames={240}>
  <Audio src={src2} volume={(f) => interpolate(f, [0, 20, 220, 240], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
</Sequence>
```

If the audio Sequence exceeds the actual clip length, the track ends mid-fade and produces an audible click. Cap it at `8s × fps = 240 frames` for Veo clips.

---

## B2 — Veo 3 clip generation

Script: `remotion/scripts/generate-clips.ts`

```bash
npx tsx remotion/scripts/generate-clips.ts --destination patagonia
npx tsx remotion/scripts/generate-clips.ts --destination patagonia --dry-run  # review prompts first
```

- Model: `veo-3.0-generate-001` (not `veo-003` — that name will 404)
- Auth: `GEMINI_API_KEY` in `.env.local` as query param `?key=KEY` on the download URL
- Poll via `ai.operations.getVideosOperation()` (not `ai.models.getVideosOperation`)
- Clips are 8s at 24fps. In a 30fps Remotion comp that's 240 frames
- Has exponential backoff for 429/503; idempotent (skips existing files)

**Clip roles — get this right or Act 2 looks disconnected:**
- Clip 1: Action/movement (arrival, trekker, suspension bridge)
- Clip 2: The specific route moment shown in the itinerary card (e.g. moraine lake for the Las Torres hike)
- Clip 3: Atmospheric/ambient for CTA background (time-lapses, wide shots — will be behind a dark scrim)

**Prompt must-haves:** specific time of day + anti-tourist detail + camera move + "cinematic travel documentary, shallow depth of field" + color grade + "9:16 vertical"

---

## B3 — ElevenLabs narration (George voice)

Script: `remotion/scripts/generate-narration.ts`

```bash
npx tsx remotion/scripts/generate-narration.ts --destination patagonia
```

- Voice ID: `JBFqnCBsd6RMkjVDRZzb` (George — Warm, Captivating Storyteller)
- Model: `eleven_turbo_v2_5`
- Settings: `stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true`
- Target: ~26 words → ~10–11 seconds (fits the 12s CTA window)

**Script formula:**
```
Plan your [Destination] trip.
[One line — what locals know that tourists miss.]
First unlock is on us.
Code [PROMO_CODE] at hiptrip dot com.
```

No Whisper needed — narration plays in a single Sequence from `CTA_IN` to `TOTAL`. Verify actual duration with `afinfo` after generating; if >12s, trim the script and regenerate.

---

## B4 — ElevenLabs ambient music bed

**No stock music licensing needed** — generate a custom 22-second ambient piece via ElevenLabs sound generation:

```js
// One-liner (run from project root with .env.local loaded)
node -e "
const dotenv = require('dotenv'); dotenv.config({ path: '.env.local' });
const fs = require('fs');
fetch('https://api.elevenlabs.io/v1/sound-generation', {
  method: 'POST',
  headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Soft cinematic ambient underscore for a [destination] travel documentary. [Instrument texture]. Slow, meditative, [quality]. [Environmental texture]. Fades in gently.',
    duration_seconds: 22,
    prompt_influence: 0.4
  })
}).then(r => r.arrayBuffer()).then(b => { fs.writeFileSync('remotion/public/music/bg-music.mp3', Buffer.from(b)); console.log('Done'); });
"
```

Output: `remotion/public/music/bg-music.mp3` — shared across all destination compositions.

**Volume envelope — duck under narration in Act 3:**
```tsx
<Audio
  src={staticFile("music/bg-music.mp3")}
  volume={(f) =>
    interpolate(f,
      [0, 20, CTA_IN - 20, CTA_IN, TOTAL - 30, TOTAL],
      [0, 0.13, 0.13, 0.05, 0.05, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    )
  }
/>
```

---

## B5 — Key lessons (Pattern B)

| Lesson | Detail |
|---|---|
| OffthreadVideo vs Video | Always use `OffthreadVideo` for Veo clips — `Video` causes jerky frames due to browser seeking. Always `muted`. |
| Audio click on transition | Happens when audio Sequence exceeds actual clip length. Cap clip 2 audio at 240f (8s × 30fps). |
| Veo model name | `veo-3.0-generate-001` — not `veo-003`. Confirm via `GET /v1beta/models` if in doubt. |
| Video download auth | Append `?key=GEMINI_API_KEY` to the video URI — Bearer token doesn't work for the download endpoint. |
| Narration too long | ElevenLabs George speaks ~2.6 words/second. At 26 words ≈ 10s. CTA window is 12s so there's comfortable buffer. If it overruns, trim the script and delete + regenerate — the script skips existing files. |
| Clip 2 matching | The itinerary act looks disconnected if clip 2 is generic. It must show the specific route moment on the card (moraine lake, souk at 7am, etc.). |
| Act 1 hook order | Tagline first (frame 0, large), destination name second (~1.2s later). Reversed from what feels natural but creates a stronger pattern interrupt. |
| Music prompt influence | `prompt_influence: 0.4` gives a good balance — higher values make it too literal, lower makes it too random. |

---

# Pattern A — Golden Wealth (Scripted Narration) — LEGACY

> ⚠️ Pattern A is the original GW ad approach (ResponsibleParent campaign). For new GW ads use Pattern C.

---

## File Layout

```
remotion/
  index.ts                        # entry point (imports Root)
  Root.tsx                        # <Composition> registry
  ResponsibleParent.tsx           # 16:9 YouTube (900f = 30s)
  ResponsibleParent9x16.tsx       # 9:16 Instagram/Reels/TikTok (810f = 27s)

public/ads/
  narration-youtube.mp3           # TTS audio for 16:9
  narration-9x16.mp3              # TTS audio for 9:16
  responsible-youtube.mp4         # rendered 16:9 output
  responsible-9x16.mp4            # rendered 9:16 output

app/responsible/page.tsx          # landing page that embeds both videos
```

---

## Step 1 — Write the script

Keep it tight. These are the word counts that worked:

| Format | Duration | Target words |
|---|---|---|
| 9:16 Instagram/Reels | 27s | ~55 words |
| 16:9 YouTube pre-roll | 30s | ~62 words |

**9:16 script (the one that worked — "responsible parent" campaign):**
> "If something happened to you tomorrow, could your family find everything? Golden Wealth gets you organized. Link your accounts, your bank, your 401k, net worth in real time. Upload your will, your deeds, your policies — encrypted and findable. Set who sees what. Spouse sees everything. Attorney sees legal. Accountant sees finances. You've done the hard part. Now finish the plan."

The opening hook ("If something happened to you tomorrow…") is the most important line. It has to create immediate emotional resonance for the responsible parent persona.

---

## Step 2 — Generate TTS

**Preferred: ElevenLabs (Rick's voice clone) — includes character-level timestamps, no Whisper needed**

Rick's voice clone ID: `bj8CeNFqDyK94BSJTsDJ`
Keeper record: "ElevenLabs Personal Claude Key" (search `elevenlabs`)

```ts
// Install: npm install elevenlabs
import { ElevenLabsClient } from 'elevenlabs'
import fs from 'fs'

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })

const response = await client.textToSpeech.convertWithTimestamps(
  'bj8CeNFqDyK94BSJTsDJ',  // Rick's voice clone
  {
    text: SCRIPT,
    modelId: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
  }
)

// response.audio_base64 = the MP3, response.alignment = character timestamps
const buffer = Buffer.from(response.audio_base64, 'base64')
fs.writeFileSync('public/ads/narration.mp3', buffer)

// Convert character timestamps → frame numbers at 30fps
// response.alignment.characters, .character_start_times_seconds, .character_end_times_seconds
const chars = response.alignment
chars.characters.forEach((ch, i) => {
  const startF = Math.round(chars.character_start_times_seconds[i] * 30)
  const endF   = Math.round(chars.character_end_times_seconds[i] * 30)
  process.stdout.write(`${ch}(${startF}-${endF}) `)
})
```

To map to scenes, group characters by sentence/phrase and take the `endF` of the last character in each phrase as the scene cut point.

**Fallback: OpenAI TTS + Whisper** (use if ElevenLabs unavailable)

```ts
import OpenAI from 'openai'
import fs from 'fs'

const openai = new OpenAI()

// Step A — generate audio
const mp3 = await openai.audio.speech.create({
  model: 'tts-1-hd',
  voice: 'onyx',
  input: SCRIPT,
})
fs.writeFileSync('public/ads/narration.mp3', Buffer.from(await mp3.arrayBuffer()))

// Step B — get timestamps via Whisper (separate call required)
const transcription = await openai.audio.transcriptions.create({
  file: fs.createReadStream('public/ads/narration.mp3'),
  model: 'whisper-1',
  response_format: 'verbose_json',
  timestamp_granularities: ['segment'],
})
transcription.segments.forEach(seg => {
  console.log(`"${seg.text.trim()}" → ${Math.round(seg.start * 30)}f–${Math.round(seg.end * 30)}f`)
})
```

**Critical (OpenAI only):** `tts-1-hd` outputs at **160kbps**, not 320kbps. Never estimate duration from file size.

---

## Step 4 — Remotion composition structure

### Composition registration (`Root.tsx`)

```tsx
<Composition
  id="ResponsibleParent-9x16"
  component={ResponsibleParent9x16}
  durationInFrames={810}   // actual audio duration in frames, rounded up
  fps={30}
  width={1080}
  height={1920}
/>
```

Set `durationInFrames` to match the actual audio length (Whisper's `duration` field × 30, rounded up to a clean number).

### Audio placement

Put `<Audio>` at the **composition level** (outside all `<Sequence>`s):

```tsx
export function ResponsibleParent9x16() {
  const frame = useCurrentFrame()
  return (
    <>
      <Audio src={staticFile('ads/narration-9x16.mp3')} />
      <Sequence from={0}   durationInFrames={122}><Scene1 /></Sequence>
      <Sequence from={122} durationInFrames={60}> <Scene2 /></Sequence>
      {/* ... */}
    </>
  )
}
```

### CRITICAL: `useCurrentFrame()` resets to 0 inside `<Sequence>`

Any component that uses `useCurrentFrame()` for composition-level animation (e.g. `FloatingCards` that should persist across scene cuts) **must live outside all `<Sequence>` wrappers**, at the top level of the composition. If you put it inside a `<Sequence>`, `frame` resets to 0 at the Sequence start — animations restart on every scene cut.

```tsx
// WRONG — FloatingCards restarts every scene
<Sequence from={0} durationInFrames={182}><FloatingCards /><Scene1 /></Sequence>

// CORRECT — FloatingCards persists at composition level
{frame < 182 && <FloatingCards opacity={frame < 122 ? 1 : 0.35} />}
<Sequence from={0}   durationInFrames={122}><Scene1 /></Sequence>
<Sequence from={122} durationInFrames={60}> <Scene2 /></Sequence>
```

---

## Step 5 — Colors: NEVER use oklch with hex-alpha appending

Remotion renders in a headless Chromium that handles CSS well, but **string interpolation of oklch values with hex-alpha suffixes produces invalid CSS**:

```ts
// WRONG — produces "oklch(0.78 0.18 76)12" which is invalid
const accentColor = 'oklch(0.78 0.18 76)'
background: `${accentColor}12`   // ← entire property ignored → black background

// CORRECT — use hex everywhere in Remotion components
const W_GREEN  = '#22c55e'
const W_NAVY   = '#0f172a'
background: `${W_GREEN}20`       // ← valid hex-alpha
```

For oklch colors, convert using Node.js `culori` or just pick the nearest hex manually. The background gradient in Scene1/Scene2 can use oklch directly in a `background` string (not appended), but any pattern like `${color}XX` must use hex.

**Established hex tokens for the Golden Wealth brand in ads:**
```ts
const W_NAVY   = '#0f172a'
const W_GREEN  = '#22c55e'
const W_BLUE   = '#3b82f6'
const W_AMBER  = '#f59e0b'
const W_ROSE   = '#f43f5e'
const W_BORDER = '#1e293b'
const W_TEXT   = '#f1f5f9'
const W_MUTED  = '#94a3b8'
const W_BG     = '#0f172a'
```

---

## Step 6 — Visual design patterns that worked

### 9:16 format (1080×1920)

- **Scene1 (hook):** Full-screen dark bg, large serif headline, floating account/document cards in background
- **Scene2 (transition):** Checklist with checkmark animation, brief pause
- **Scene3 (features):** `FeatureScene9x16` — eyebrow label + bold headline at top, compact widget card below. Three sub-scenes via nested `<Sequence>`. No browser chrome, no sidebar — just the content rows in a white rounded card.
- **MidCTABadge:** Persistent pill at bottom (`from={182}`) showing "Start for free → live-golden.com"
- **EndCard:** Typewriter URL animation + pulsing CTA button

Widget components (`AccountsWidget`, `DocsWidget`, `AccessWidget`) show 3-4 animated rows of real-looking app data. Rows animate in with `spring()` staggered by index.

### 16:9 format (1920×1080)

- **FeatureScene layout:** `flexDirection: 'row'` (explicit! forgetting this causes vertical stacking), copy on left (`width:580`), app mockup on right (`flex:1, justifyContent:'flex-end'`)
- **AppShell:** Browser chrome + sidebar + main content area at `width:840, height:500`
- **Background:** Dark gradient, subtle grid lines via repeating-linear-gradient
- **Scene1:** Hook headline full-screen (no mockup)
- **Scene2:** Brand intro + tagline
- **FeatureScenes:** One per major product area (Accounts, Documents, Access, Contacts)
- **EndCard:** URL + CTA

---

## Step 7 — Rendering

```bash
# 9:16
npx remotion render remotion/index.ts ResponsibleParent-9x16 public/ads/responsible-9x16.mp4 --overwrite

# 16:9
npx remotion render remotion/index.ts ResponsibleParent-YouTube public/ads/responsible-youtube.mp4 --overwrite
```

Render times: ~2–3 minutes per video on M-series Mac. Output sizes: 5–8 MB typical.

---

## Step 8 — Landing page embedding

### 9:16 in phone mockup (`AdVideoSection`)

- Embed with `autoPlay muted loop playsInline` — browsers require `muted` for autoplay
- Add a tap-to-unmute toggle button overlaid on the phone frame (bottom-right corner)
- State: `const [muted, setMuted] = useState(true)` + `ref` on the `<video>` element

```tsx
<video ref={videoRef} src="/ads/responsible-9x16.mp4" autoPlay muted={muted} loop playsInline ... />
<button onClick={() => setMuted(m => !m)}>
  {muted ? 'Tap for sound' : 'Sound on'}
</button>
```

### 16:9 in `YouTubeAdSection`

- Embed with `controls playsInline` — no autoplay, user initiates
- Wrap in `aspectRatio: '16/9'` container with intersection observer for fade-in

---

## Campaign briefs

Five campaign concepts live in `marketing/briefs/` on the `ads-landing` branch:
- `panic-moment.md` — "If something happened to you tomorrow…"
- `quiz.md` — interactive quiz format
- `doc-chaos.md` — document disorganization pain
- `responsible-parent.md` — the one we built
- `ai-assistant.md` — AI-powered wealth planning

---

## Key lessons learned

| Lesson | Detail |
|---|---|
| ElevenLabs preferred | Use `convertWithTimestamps` — returns audio + character-level timing in one call. No Whisper needed. |
| Rick's voice clone | ElevenLabs voice ID `bj8CeNFqDyK94BSJTsDJ`. Key in Keeper: "ElevenLabs Personal Claude Key". |
| OpenAI TTS bitrate | `tts-1-hd` outputs 160kbps, not 320kbps. Never estimate duration from file size. |
| OpenAI needs Whisper | OpenAI TTS has no built-in timestamps — always run Whisper separately to get segment timing. |
| oklch in Remotion | Safe in `background:` string values, but NEVER append hex-alpha to an oklch string. |
| `useCurrentFrame` scope | Resets to 0 inside each `<Sequence>`. Composition-wide animations must live outside all Sequences. |
| `flexDirection` | Always set explicitly in Remotion inline styles — don't rely on default. Missing it caused 16:9 feature scenes to stack vertically. |
| Script length | ~55 words = ~24s for `onyx` voice. Leave 3s of buffer vs. composition duration. |
| Phone mockup column | Use `flex-[1]` not a fixed width; use `max-w-[210px]` on the phone frame itself. |
