# Flappy Bird Another Version

A Vite + TypeScript + Canvas Flappy Bird-style web game with manual play, AI agent mode, local high scores, and customizable character themes.

## Setup

```bash
npm install
npm run dev
```

## Controls

- `Space`, click, or tap: flap
- `P`: pause or resume
- `Start / Restart`: reset and start a new run
- `AI Agent plays`: god-mode autopilot (near-invincible trajectory correction)
- `Difficulty`: Easy / Normal / Hard
- `Sound`: toggles generated Web Audio sound effects
- `Skin / Character`: Puri (default), Sunny Bird, Neon Bat, or custom sprite strips

## Scores

Scores are saved in `localStorage` in the browser. No backend, login, Supabase, or Firebase setup is required.

## Custom Character Sprites

The `Puri` character uses sprite strips from:

```text
public/assets/characters/creature/
```

The renderer switches between idle, flap, peak, fall, and dead strips based on velocity/status.

## Controls

- `Space`, click, or tap: flap
- `P`: pause or resume
- `Start / Restart`: reset and start a new run
- `AI Agent plays`: god-mode autopilot (near-invincible trajectory correction)
- `Difficulty`: Easy / Normal / Hard
- `Sound`: toggles generated Web Audio sound effects
- `Skin / Character`: Puri (default), Sunny Bird, Neon Bat, or custom sprite strips

## Scores

Scores are saved in `localStorage` in the browser. No backend, login, Supabase, or Firebase setup is required.

## Custom Character Sprites

The `Puri` character uses sprite strips from:

```text
public/assets/characters/creature/
```

The renderer switches between idle, flap, peak, fall, and dead strips based on velocity/status.
