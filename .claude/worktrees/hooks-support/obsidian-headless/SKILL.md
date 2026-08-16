---
name: obsidian-headless
description: Read and write notes in the user's Obsidian PersonalVault and sync them to Obsidian Sync. Use whenever saving notes, reading vault content, or syncing vault changes.
---

# Obsidian Headless

Headless Obsidian Sync client for Linux (no desktop app). Vault is a plain folder on disk — read/write `.md` files directly, then sync.

> **Environment config** (binary path, vault path, vault ID) lives in `TOOLS.md`, not here.

## Discovering the vault

If vault path isn't in `TOOLS.md`, run:

```bash
<obsidian-headless-bin> sync-list-local
```

Output shows vault ID and local path. Use the path for all subsequent commands.

## Writing notes

Write `.md` files directly to the vault folder — no CLI needed for that part. Then sync.

- Claude session notes → `Claude/YYYY-MM-DD-slug.md`
- Use Write or Edit tools, then run sync

## Syncing

**Always sync after writing** so changes reach the user's devices.

```bash
<obsidian-headless-bin> sync --path <vault-path>
```

Check sync status:

```bash
<obsidian-headless-bin> sync-status --path <vault-path>
```

## Pitfalls

- **No `--vault-id` flag** — use `--path` instead
- **`sync-status` requires `--path`** — bare `sync-status` errors with "No sync configuration found for /"
- **Not in PATH** — use the full binary path from `TOOLS.md`
- Sync is bidirectional; always pull before bulk edits to avoid conflicts
