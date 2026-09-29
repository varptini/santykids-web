# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static catalog site for **SantyKids** (handmade children's accessories).
Single `index.html` fetches `catalog.json` at load and renders the product
grid client-side — no build step, no framework. `images/products/` holds the
product photos referenced by `catalog.json`.

**Branch `supabase-catalog`:** `index.html` now reads products from Supabase
(`products` table, `estado='publicado'`) with the public publishable key; there
is no `catalog.json` sync anymore. Products are managed from Telegram by the
bot in `~/proyectos/santykids-bot`. `catalog.json` is kept only as legacy.
On `master` the old flow still applies (bot-monitos-pro pushes catalog.json).

## Commands

No build. Open `index.html` directly or serve the folder with any static
server for local preview:

```bash
python3 -m http.server 8000
```

Deployed via GitHub (repo `varptini/santykids-web`) — pushes to the tracked
branch are what goes live.

## Architecture

- `index.html` — markup + inline JS (`fetch('/catalog.json')` around line 725) + inline styles, all in one file.
- `catalog.json` — array of products (`id`, `nombre`, `imagen`, `caption`, ...), synced from the bot.
- `images/products/` — product images, filenames referenced by `catalog.json.imagen`.
