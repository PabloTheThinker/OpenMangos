# OpenMangos mascot

Canonical character asset for README, Vektra product page, and brand use.

## Source file (v2)

**User asset:** `~/Pictures/Open Mangos Mascotv2.png`

Friendly mango operator with yellow hard hat, green leaf, orange tool belt, and **“Hi My Name is / Open Mangos”** name badge. Glossy 3D cartoon style on black background.

## Repo files

| File | Use |
|---|---|
| `openmangos-mascot.png` | Full mascot, transparent background (863×1152) |
| `openmangos-mascot-logo.png` | Small crop for README SVG embed (150×200) |
| `openmangos-logo-text.svg` | GitHub README — dark theme |
| `openmangos-logo-text-dark.svg` | GitHub README — light theme |

**Vektra site** (`vektra-industries/public/`):

| File | Use |
|---|---|
| `openmangos-portrait.png` | `/openmangos` hero portrait |
| `openmangos-mark.png` | Nav / product mark |

## Brand colors

| Token | Hex |
|---|---|
| Accent bright | `#ffc857` |
| Accent | `#f5a623` |
| Accent dim | `#c77800` |
| Background | `#0a0908` |

## Recreate / vary (image gen)

Use **image edit** with `openmangos-mascot.png` as reference. Describe only what changes; keep hard hat, badge, leaf, and orange mango body consistent.

Example variation prompt:

```
Same OpenMangos mango mascot character: yellow construction hard hat, green leaf, orange tool belt, "Hi My Name is / Open Mangos" name badge, friendly smile. Change pose to [wave / point / thumbs up]. Keep glossy 3D cartoon style, black or transparent background, no extra text, no UI chrome.
```

## Update workflow

1. Replace source PNG in `~/Pictures/` or drop new file in `assets/`.
2. Re-run transparent cutout: `convert input.png -fuzz 14% -transparent black -resize 864x1152\> -strip openmangos-mascot.png`
3. Regenerate `openmangos-mascot-logo.png` and SVG wordmarks.
4. Copy hero to `vektra-industries/public/openmangos-portrait.png`.