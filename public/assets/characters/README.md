# Character Assets

## Option A — No images (easiest)

Sunny Bird and Neon Bat are drawn on the canvas. Add a theme in `src/themes/themes.ts` with only `bodyColor`, `wingColor`, etc. No PNG required.

## Option B — One still PNG

Put a transparent PNG in `public/assets/characters/` and set `imageUrl` on the character. The game fakes motion with rotation and scale. No sprite frames needed.

## Option C — Animated strips (Puri style)

Use **separate PNG files per motion**, not seven different poses total:

| Strip file | When it plays |
|------------|----------------|
| `idle.png` | Slow fall / hover |
| `flap.png` | After flap up |
| `peak.png` | Top of arc |
| `fall.png` | Falling |
| `dead.png` | Game over |

Each file is **one horizontal row** cut into equal slices:

- `stripFrameCount` = number of slices in that row (Puri uses `7` per file).
- Each slice is usually the **same pose** with small changes (blink, bob, wing flap) — not 7 different actions.
- The **different actions** are the **different files** (`idle.png`, `flap.png`, …).
- If your art is one drawing per file, set `stripFrameCount: 1`.

**Was Puri correct?** Yes — five strip files plus `stripFrameCount: 7` matches this engine, as long as each PNG is one row of seven equal-width frames.

## Still vs animated strips

If a 7-frame loop looks jumpy or clipped (e.g. Tigu), use one hero frame per file:

```ts
stripAnimate: false,
stripHeroFrameIndex: 3, // 0-based; middle frame is often best
```

The game still swaps `idle` / `flap` / `peak` / `fall` / `dead` by flight — it just does not cycle all 7 cells in each PNG.

For maximum quality, export **one transparent PNG per pose** (96×96 or larger) and either set `stripFrameCount: 1` on each file or use a single `imageUrl` still.

Example in `themes.ts`:

```ts
animationStrips: {
  idle: '/assets/characters/my-char/idle.png',
  flap: '/assets/characters/my-char/flap.png',
  // peak, fall, dead optional — missing strips fall back to idle
},
stripFrameCount: 4,
preserveAlpha: true
```

## Option D — One atlas with coordinates

Use `spriteFrames` with `x`, `y`, `width`, `height` per named frame (`idle`, `flap`, `peak`, `fall1`, `fall2`, `fastFall`, `dead`). See `CharacterTheme` in `src/game/types.ts`.
