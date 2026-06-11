# OpenMangos mascot — image prompts

Prompts used to generate the OpenMangos character. Reuse with `image_edit` and the reference files in this folder to keep the character consistent.

## Brand colors

| Token | Hex |
|---|---|
| Accent bright | `#ffc857` |
| Accent | `#f5a623` |
| Accent dim | `#c77800` |
| Background | `#0a0908` |

---

## Hero portrait

**File:** `../public/openmangos-portrait.png` on [vektra-industries](https://github.com/PabloTheThinker/vektra-industries)  
**Use:** Vektra product page hero (`/openmangos`), ILO-style character introduction  
**Aspect ratio:** `9:16`

```
Full-body anthropomorphic mango mascot character portrait for a software product hero page, tall vertical composition like a character introduction poster. Friendly waving mango with green leaf, terminal badge on chest, warm orange gradient body, clean Apple-style kawaii illustration, soft mango glow on deep charcoal transparent background, character fills most of the frame vertically, no text, no UI, premium product mascot portrait similar to ILO agent character pages.
```

---

## Square mascot

**File:** `openmangos-mascot.png`  
**Use:** GitHub README logo (`openmangos-logo-text.svg`)  
**Aspect ratio:** `1:1`

```
Friendly anthropomorphic mango mascot character for a software brand, standing pose, minimal Apple-style product mascot illustration. Rounded mango body with small leaf on head, subtle confident expression, one arm raised in a welcoming gesture, wearing a tiny terminal prompt chevron badge on chest. Warm orange and gold tones (#ffc857, #f5a623), clean vector-flat illustration style, soft subtle shadow, transparent or pure white background, no text, no photorealism, no busy background scene, character only centered, premium tech mascot like OpenClaw lobster or Hermes agent character.
```

---

## App icon mark (alternate)

**Use:** App icon / favicon concept — mango + terminal chevron, not full character  
**Aspect ratio:** `1:1`

```
Minimal OpenMangos app icon mark: abstract mango silhouette fused with a terminal prompt chevron, geometric and premium Apple-style product icon aesthetic. Warm mango orange gradient (#ffc857 to #f5a623) on deep charcoal rounded-square background (#0a0908). Clean flat vector look, no text, no photorealism, no busy background grid, centered single mark, subtle soft glow, high contrast, icon design for software brand.
```

---

## Variation workflow

1. Start from `openmangos-mascot.png` or `openmangos-portrait.png` as the reference image.
2. Use **image edit**, not text-to-image, when the same character must appear again.
3. Describe only what changes — pose, scene, expression — and note what should stay the same.
4. Avoid asking the model to render exact text on the character; add wordmarks in SVG or code instead.