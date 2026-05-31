# Remotion Video Ads

**Before starting:** Read this project's `CLAUDE.md` for the `## Remotion Video Ads` section. It contains the pattern assignment, composition paths, voice ID, brand tokens, asset paths, and package scripts. Do not proceed without it.

Three production patterns — your project CLAUDE.md specifies which one applies:

| Pattern | TTS | Video | When to use |
|---|---|---|---|
| **A — Scripted narration** | ElevenLabs `convertWithTimestamps` or OpenAI TTS + Whisper | Animated UI mockups | Script drives timing; scene cuts sync to word boundaries |
| **B — Multi-clip cinematic** | ElevenLabs narration + ElevenLabs Sound Generation | AI video (Veo) full-bleed backgrounds | Multi-clip ads with ambient music bed, no Whisper needed |
| **C — Multi-concept A/B** | ElevenLabs narration + ElevenLabs Sound Generation | Veo lifestyle clips or pure motion typography | 3-act emotional story ads, multiple concepts tested simultaneously |

---

# Pattern C — Multi-Concept A/B Emotional Story Ads

Three-act emotional story ads (9:16, 20–24s each), multiple concepts tested simultaneously. Each concept explores a different emotional angle (e.g. urgency, aspiration, contrast).

---

## C1 — Brand constants (mandatory for every project)

Create `remotion/brand.ts` as a single source of truth. **Every composition and every generation script must import from here — never hardcode brand values.**

```ts
// remotion/brand.ts — fill in values from your project CLAUDE.md
export const BRAND = {
  url:       'your-domain.com',
  urlSpoken: 'your dash domain dot com',  // for ElevenLabs TTS — spell out punctuation
  name:      'Brand Name',
  ctaText:   'Start free',
  ctaButton: 'Start free — your-domain.com',
}
```

The `urlSpoken` field is critical. ElevenLabs will mispronounce URLs if you pass the raw domain. Always write it phonetically.

---

## C2 — Quality workflow (MANDATORY — do not skip)

**Always run both checks before declaring an ad done.**

### Step 1 — Visual stills check

Render stills at 3 key frames per composition (early hook, mid-act-2, final CTA) and review:

```bash
# Render a still at a specific frame (0-indexed)
npx remotion still <entry-file> <CompositionId> <output.png> --frame=<N>
```

Checklist:
- [ ] URL shows correct domain (not a wrong/placeholder version)
- [ ] Act 1 text is readable and sized for 1080×1920 canvas
- [ ] Act 2 elements fill the canvas (not tiny app-UI-sized components)
- [ ] Act 3 CTA is visible — URL and button both present
- [ ] No empty/blank frames

### Step 2 — Narration dry-run

Always add a `--dry-run` flag to narration generation scripts. Print every line of spoken text to console before making any ElevenLabs API calls. Confirm:
- URL is spoken phonetically
- Brand name is correct
- No placeholder text leaked in

Only then generate for real.

---

## C3 — Three-act composition structure

Music must start at **frame 0 of the composition**, not inside a `<Sequence>`. Placing `<Audio>` inside `<Sequence from={N}>` causes silence until that sequence starts — the entire first half of the ad plays silently.

```tsx
export function AdConcept() {
  const frame = useCurrentFrame()

  return (
    <AbsoluteFill>
      {/* Music at composition level — runs the full 20–24s */}
      <Audio
        src={staticFile('music/concept-music.mp3')}
        volume={(f) => {
          if (f < ACT3_START) return 0.22
          return interpolate(f, [ACT3_START, ACT3_START + 50], [0.22, 0.8], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          })
        }}
      />

      {/* Fade out acts 1–2 just before hard cut */}
      <Sequence from={0} durationInFrames={ACT3_START + 8}>
        <div style={{
          opacity: interpolate(frame, [ACT3_START - 10, ACT3_START + 8], [1, 0], {
            extrapolateLeft: 'clamp', extrapolateRight: 'clamp',
          }),
          width: '100%', height: '100%', position: 'absolute',
        }}>
          <Acts12 />
        </div>
      </Sequence>

      {/* Act 3: hard cut */}
      <Sequence from={ACT3_START} durationInFrames={TOTAL - ACT3_START}>
        <Act3CTA />
      </Sequence>
    </AbsoluteFill>
  )
}
```

---

## C4 — Designing for 1080×1920 canvas

**Never use app/website components at their web scale.** A 250px-wide card at `scale(0.68)` on a 1920px-tall canvas is invisible. Build purpose-built video components.

Font size targets:
- Headlines: **80–100px**
- Body / data rows: **48–56px**
- Labels / sub-labels: **36–42px**

Layout targets:
- Rows must span near-full width (~900–960px)
- Row height: **80–100px** with breathing room
- Padding: at least **60px** horizontal gutters

Two-column layouts:
- At 56px font, each column is ~450px wide — max ~14 chars per line
- Use `whiteSpace: 'nowrap'` + `overflow: 'hidden'` on column containers
- Keep items to max 13–14 chars or they collide with the centre divider

---

## C5 — Asset generation principles

**Generate in this order:** music -> narration (dry-run first) -> video clips (most expensive). Always use `--dry-run` on narration scripts before spending ElevenLabs credits.

**Veo clips must be web-optimized before Remotion can play them.** Veo outputs have the `moov` atom at the end — browsers cannot stream them until it's moved to the front:
```bash
ffmpeg -y -i input.mp4 -c:v libx264 -profile:v baseline -level 3.1 \
  -pix_fmt yuv420p -movflags +faststart -crf 23 -an output.mp4
```

**Asset location:** Remotion serves static files from the **root `public/`** directory by default, not `remotion/public/`. If `staticFile()` returns 404s, confirm the files are in `{project-root}/public/`, not nested under `remotion/`.

**`OffthreadVideo` must always be `muted`.** Audio lives in separate `<Audio>` components at composition level.

---

## C6 — Key lessons from production

| Lesson | Detail |
|---|---|
| **brand.ts is mandatory** | Hardcoded URLs appeared in 4 composition files AND in the spoken narration. Always import from `remotion/brand.ts`. |
| **Dry-run narration first** | Narration spoke the wrong URL out loud. `--dry-run` flag prints all text before calling ElevenLabs. Non-negotiable. |
| **Music at composition level** | Music inside `<Sequence from={390}>` was silent for 13s. `<Audio>` belongs at the top of the composition, outside all sequences. |
| **App UI components are too small** | Web-scale components (250px wide) at `scale(0.68)` on a 1920px-tall canvas = invisible. Build purpose-built video UI. |
| **Short items in two-column layouts** | At 56px font + ~450px column, items over 14 chars wrap and collide. Use `whiteSpace: 'nowrap'` + short copy. |
| **Veo needs faststart** | Veo outputs have moov atom at end -> browser can't stream. Always re-encode with `-movflags +faststart`. |
| **Root public/, not remotion/public/** | Remotion serves from root `public/` by default. 404s almost always mean assets are in the wrong folder. |
| **Render stills before done** | Render 3 stills per composition. Open them. Check every item on the checklist. Do not ship without this step. |

---

# Pattern B — Multi-Clip Cinematic Ads

AI-generated video backgrounds (Veo) + ElevenLabs narration + ElevenLabs ambient music bed. Each ad covers one subject (destination, product story, etc.) in a 20–24s 9:16 format.

See your project CLAUDE.md for composition paths, data source files, CLI conventions, and the narration script formula.

---

## B1 — Composition structure

Three acts with crossfading Veo clips as full-bleed backgrounds:

```
Act 1 (0–150f, 0–5s):    Hook — subject descriptor at frame 0, subject name rises ~1.2s later
Act 2 (150–360f, 5–12s): Detail — rotating content items, video stays visible
Act 3 (360–720f, 12–24s): CTA — dark scrim, narration, music ducks
```

**Critical: `OffthreadVideo` must always be `muted`. Audio lives in separate `<Audio>` components.**

```tsx
// Video layer — always muted
<Sequence from={CLIP2_START} durationInFrames={CLIP2_DUR}>
  <OffthreadVideo src={src2} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
</Sequence>

// Audio for clip 2 — capped at actual clip duration (240f = 8s x 30fps) to avoid click
<Sequence from={CLIP2_START} durationInFrames={240}>
  <Audio src={src2} volume={(f) => interpolate(f, [0, 20, 220, 240], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
</Sequence>
```

If the audio Sequence exceeds the actual clip length, the track ends mid-fade and produces an audible click. Cap it at `8s x fps = 240 frames` for Veo clips.

---

## B2 — Veo clip generation

```bash
npx tsx remotion/scripts/generate-clips.ts --subject <slug>
npx tsx remotion/scripts/generate-clips.ts --subject <slug> --dry-run  # review prompts first
```

- Model: `veo-3.0-generate-001` (not `veo-003` — that name will 404)
- Auth: `GEMINI_API_KEY` in `.env.local` as query param `?key=KEY` on the download URL
- Poll via `ai.operations.getVideosOperation()` (not `ai.models.getVideosOperation`)
- Clips are 8s at 24fps. In a 30fps Remotion comp that's 240 frames
- Implement exponential backoff for 429/503; make the script idempotent (skips existing files)

**Clip roles — get this right or Act 2 looks disconnected:**
- Clip 1: Action/movement — arrival, approach, opening moment of the subject
- Clip 2: The specific detail shown in the Act 2 content card — must match what the card describes
- Clip 3: Atmospheric/ambient for CTA background (time-lapses, wide shots — will be behind a dark scrim)

**Prompt must-haves:** specific time of day + evocative detail + camera move + "cinematic, shallow depth of field" + color grade + "9:16 vertical"

---

## B3 — ElevenLabs narration

```bash
npx tsx remotion/scripts/generate-narration.ts --subject <slug>
```

- Model: `eleven_turbo_v2_5`
- Settings: `stability: 0.4, similarity_boost: 0.8, style: 0.3, use_speaker_boost: true`
- Voice ID: configure in your project CLAUDE.md
- Target: ~26 words -> ~10–11 seconds (fits a 12s CTA window)

**Script formula:** configure in your project CLAUDE.md — it should include brand name, one insight line, and the CTA with a phonetically spelled URL.

No Whisper needed — narration plays in a single Sequence from `CTA_IN` to `TOTAL`. Verify actual duration with `afinfo` after generating; if it overruns the CTA window, trim the script and regenerate.

---

## B4 — ElevenLabs ambient music bed

**No stock music licensing needed** — generate a custom ambient piece via ElevenLabs sound generation:

```js
node -e "
const dotenv = require('dotenv'); dotenv.config({ path: '.env.local' });
const fs = require('fs');
fetch('https://api.elevenlabs.io/v1/sound-generation', {
  method: 'POST',
  headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({
    text: 'Soft cinematic ambient underscore for a [subject] [genre]. [Instrument texture]. Slow, meditative. [Environmental texture]. Fades in gently.',
    duration_seconds: 22,
    prompt_influence: 0.4
  })
}).then(r => r.arrayBuffer()).then(b => { fs.writeFileSync('remotion/public/music/bg-music.mp3', Buffer.from(b)); console.log('Done'); });
"
```

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
| Audio click on transition | Happens when audio Sequence exceeds actual clip length. Cap clip audio at 240f (8s x 30fps). |
| Veo model name | `veo-3.0-generate-001` — not `veo-003`. Confirm via `GET /v1beta/models` if in doubt. |
| Video download auth | Append `?key=GEMINI_API_KEY` to the video URI — Bearer token doesn't work for the download endpoint. |
| Narration too long | ElevenLabs speaks ~2.6 words/second. At 26 words ~10s. If it overruns, trim the script and delete + regenerate. |
| Clip 2 must match Act 2 | Act 2 looks disconnected if clip 2 is generic. It must show the specific moment described on the content card. |
| Act 1 hook order | Subject descriptor first (frame 0, large), subject name second (~1.2s later). Creates a stronger pattern interrupt. |
| Music prompt influence | `prompt_influence: 0.4` gives a good balance — higher values make it too literal, lower makes it too random. |

---

# Pattern A — Scripted Narration Ads

Word-boundary scene cuts driven by TTS timestamps. Each scene change aligns to a phrase or sentence boundary in the audio. Use for product demo ads where the narration explains features as they appear on screen.

---

## File layout

```
remotion/
  index.ts                    # entry point (imports Root)
  Root.tsx                    # <Composition> registry
  <YourComposition>.tsx       # 16:9 version
  <YourComposition>9x16.tsx   # 9:16 version

public/ads/
  narration-youtube.mp3       # TTS audio for 16:9
  narration-9x16.mp3          # TTS audio for 9:16
```

---

## Step 1 — Write the script

Keep it tight:

| Format | Duration | Target words |
|---|---|---|
| 9:16 Instagram/Reels | 27s | ~55 words |
| 16:9 YouTube pre-roll | 30s | ~62 words |

The opening hook is the most important line — it must create immediate emotional resonance for the target persona. Write it first, then build the feature walkthrough around it.

---

## Step 2 — Generate TTS

**Preferred: ElevenLabs `convertWithTimestamps`** — returns audio + character-level timing in one call. No Whisper needed.

Voice ID: configure in your project CLAUDE.md.

```ts
import { ElevenLabsClient } from 'elevenlabs'
import fs from 'fs'

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY })

const response = await client.textToSpeech.convertWithTimestamps(
  YOUR_VOICE_ID,  // from project CLAUDE.md
  {
    text: SCRIPT,
    modelId: 'eleven_multilingual_v2',
    outputFormat: 'mp3_44100_128',
  }
)

const buffer = Buffer.from(response.audio_base64, 'base64')
fs.writeFileSync('public/ads/narration.mp3', buffer)

// Convert character timestamps -> frame numbers at 30fps
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
  console.log(`"${seg.text.trim()}" -> ${Math.round(seg.start * 30)}f–${Math.round(seg.end * 30)}f`)
})
```

**Critical (OpenAI only):** `tts-1-hd` outputs at **160kbps**, not 320kbps. Never estimate duration from file size.

---

## Step 3 — Composition structure

### Registration (`Root.tsx`)

```tsx
<Composition
  id="YourAd-9x16"
  component={YourAd9x16}
  durationInFrames={810}   // actual audio duration in frames, rounded up
  fps={30}
  width={1080}
  height={1920}
/>
```

Set `durationInFrames` to match the actual audio length (Whisper's `duration` x 30, rounded up).

### Audio placement

Put `<Audio>` at the **composition level** (outside all `<Sequence>`s):

```tsx
export function YourAd9x16() {
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

### `useCurrentFrame()` resets to 0 inside `<Sequence>`

Any component that uses `useCurrentFrame()` for composition-level animation **must live outside all `<Sequence>` wrappers**. If placed inside a `<Sequence>`, `frame` resets to 0 at the Sequence start — animations restart on every scene cut.

```tsx
// WRONG — FloatingCards restarts every scene
<Sequence from={0} durationInFrames={182}><FloatingCards /><Scene1 /></Sequence>

// CORRECT — FloatingCards persists at composition level
{frame < 182 && <FloatingCards opacity={frame < 122 ? 1 : 0.35} />}
<Sequence from={0}   durationInFrames={122}><Scene1 /></Sequence>
<Sequence from={122} durationInFrames={60}> <Scene2 /></Sequence>
```

---

## Step 4 — Colors: NEVER use oklch with hex-alpha appending

```ts
// WRONG — produces "oklch(0.78 0.18 76)12" which is invalid CSS
const color = 'oklch(0.78 0.18 76)'
background: `${color}12`   // entire property ignored -> black background

// CORRECT — use hex everywhere in Remotion components
const TOKEN = '#22c55e'
background: `${TOKEN}20`  // valid hex-alpha
```

oklch is safe in plain `background:` string values, but never append hex-alpha to an oklch string. Use `culori` or pick the nearest hex manually.

---

## Step 5 — Design patterns that worked

### 9:16 format (1080x1920)

- **Hook scene:** Full-screen dark bg, large serif headline, floating data cards in background
- **Transition scene:** Checklist with checkmark animation
- **Feature scenes:** Eyebrow label + bold headline at top, compact widget card below; three sub-scenes via nested `<Sequence>`; no browser chrome — just content rows in a white rounded card at video scale
- **Persistent CTA badge:** Pill element that appears mid-ad and persists to end
- **End card:** Typewriter URL animation + pulsing CTA button

Data row components show 3–4 animated rows with `spring()` staggered by index.

### 16:9 format (1920x1080)

- **Feature scene layout:** `flexDirection: 'row'` (explicit — forgetting this causes vertical stacking), copy on left (~580px wide), app mockup on right (`flex:1, justifyContent:'flex-end'`)
- **App shell:** Browser chrome + sidebar + content area at ~840x500
- **Background:** Dark gradient, subtle grid lines via `repeating-linear-gradient`
- **Scene order:** Hook (full-screen) -> Brand intro -> Feature scenes (one per product area) -> End card

---

## Step 6 — Rendering

```bash
# 9:16
npx remotion render <entry-file> <CompositionId-9x16> public/ads/<output>-9x16.mp4 --overwrite

# 16:9
npx remotion render <entry-file> <CompositionId-YouTube> public/ads/<output>-youtube.mp4 --overwrite
```

Render times: ~2–3 minutes per video on M-series Mac.

---

## Step 7 — Landing page embedding

### 9:16 in phone mockup

- Embed with `autoPlay muted loop playsInline` — browsers require `muted` for autoplay
- Add a tap-to-unmute toggle overlaid on the frame

```tsx
<video ref={videoRef} src="/ads/your-9x16.mp4" autoPlay muted={muted} loop playsInline />
<button onClick={() => setMuted(m => !m)}>
  {muted ? 'Tap for sound' : 'Sound on'}
</button>
```

### 16:9

- Embed with `controls playsInline` — no autoplay
- Wrap in `aspectRatio: '16/9'` container

---

## Key lessons (Pattern A)

| Lesson | Detail |
|---|---|
| ElevenLabs preferred | `convertWithTimestamps` returns audio + character-level timing in one call. No Whisper needed. |
| OpenAI TTS bitrate | `tts-1-hd` outputs 160kbps, not 320kbps. Never estimate duration from file size. |
| OpenAI needs Whisper | OpenAI TTS has no built-in timestamps — always run Whisper separately for segment timing. |
| oklch in Remotion | Safe in `background:` string values, but NEVER append hex-alpha to an oklch string. |
| `useCurrentFrame` scope | Resets to 0 inside each `<Sequence>`. Composition-wide animations must live outside all sequences. |
| `flexDirection` | Always set explicitly in Remotion inline styles. Missing it caused 16:9 feature scenes to stack vertically. |
| Script length | ~55 words ~24s for a mid-pace voice. Leave 3s of buffer vs. composition duration. |
