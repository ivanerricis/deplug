# Deplug brand assets

The mark is a **D** whose two prongs have just been pulled out of the flat edge: a plug being disconnected.

| File | Use |
| --- | --- |
| `deplug-mark.svg` | One-colour (black) mark, for print and single-colour contexts |
| `deplug-mark-white.svg` | One-colour (white) mark for dark or coloured backgrounds |
| `deplug-mark-color.svg` | Full colour on light backgrounds |
| `deplug-mark-color-on-dark.svg` | Full colour on dark backgrounds |
| `deplug-mark-small.svg` | Simplified cut for 16–32 px (thicker prongs); white D on a dark tile |
| `deplug-app-icon.svg` | App icon source (1024 px dark tile) for sizes of 48 px and above; `public/favicon.svg` is a copy of it |
| `deplug-app-icon-small.svg` | Same tile with the small-size cut (thicker prongs), used for the 16, 24, 30, 32 and 44 px icons |

## Colours

| Name | HEX | Use |
| --- | --- | --- |
| Ink | `#14161A` | D on light backgrounds, icon tile |
| Signal | `#FF5C39` | Prongs (the "disconnected" accent) |
| White | `#FFFFFF` | D on dark backgrounds |

Signal on white is about 3:1, which is fine for the decorative prongs but not for text.

## Usage

- Keep clear space around the mark equal to the width of one prong (48 units in the 256 grid).
- Do not recolour the D, stretch the mark, add effects, or close the gap between prongs and D.
- Below 24 px use `deplug-mark-small.svg`.

## Regenerating the app icons

Render `deplug-app-icon.svg` to a 1024×1024 PNG and run `npx tauri icon <png>`, then delete the generated `android/` and `ios/` folders (the app is desktop only). Afterwards re-render the sizes below 48 px (`32x32.png`, `Square30x30Logo.png`, `Square44x44Logo.png` and the 16/24/32 px entries of `icon.ico`) from `deplug-app-icon-small.svg`, so the prongs stay readable.
