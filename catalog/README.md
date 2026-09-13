# Verified LEGO part catalog

Algo only talks about real LEGO pieces. This folder builds the list of parts and
colors both apps use, from [Rebrickable](https://rebrickable.com/downloads/)'s
public database dumps.

## What "verified" means

- Every part number in `curated.json` must exist in Rebrickable's `parts.csv`.
- A part is offered in a color only if Rebrickable's `elements.csv` lists a real
  LEGO element id for that part + color. If LEGO never made a blue tyre, Algo
  cannot ask for one.
- Colors carry the official name and RGB from `colors.csv`.

The build fails loudly if any of this is not true.

## Files

| File | Role |
|---|---|
| `curated.json` | Hand-edited input: which parts and colors Algo knows, the kid-facing shape family, and the friendly name Algo says out loud. Edit this. |
| `build-catalog.mjs` | Downloads the dumps, verifies, and writes the three outputs below. |
| `csv.mjs` | Small RFC 4180 CSV parser (part names contain commas and quotes). |
| `catalog.json` | Canonical output. |
| `catalog.js` | Same data as `window.ALGO_CATALOG`, loaded by `index.html` before `app.js`. |
| `../mobile/src/catalog/catalog.generated.ts` | Same data as a typed export for the Expo app. |
| `catalog.test.mjs` | Invariants: unique parts, every part has a verified color, generated copies are in sync, attribution present. |
| `cache/` | Downloaded `.csv.gz` dumps (git-ignored, about 3 MB). |

## Refresh or extend

```sh
npm run catalog:build            # download today's dumps and rebuild everything
npm run catalog:build:offline    # rebuild from catalog/cache without downloading
npm test                         # invariants
```

To add a part: find its number on rebrickable.com (the "Part Num", e.g. `3005`
for Brick 1 x 1), add `{ "partNum": "3005", "family": "short", "kidName": "1 × 1 brick" }`
to `curated.json`, rebuild. To add a color: add `{ "id": <Rebrickable color id>, "kid": "<one word>" }`;
the apps draw any color from its RGB, but a new kid word only becomes selectable in
the UI once the design steps use it.

`family` must be one of the seven shapes the apps can draw:
`brick`, `short`, `plate`, `slope`, `curve`, `wheel`, `axle`.

## Using it in code

Web (`app.js`): `describePiece('3001', 1)` returns `{ partNum, colorId, elementId,
color: 'blue', shape: 'brick', hex, name: 'blue 2 × 4 brick', officialName: 'Blue Brick 2 x 4' }`.

Mobile (`mobile/src/catalog`): same `describePiece`, plus `getPart`, `getColor`,
`elementFor`, `isVerified`, `partsInFamily`, `displayHex`, `labelPiece`.

A scan result (`DetectedPiece`) now carries `partNum` and `colorId`; the on-device
vision model's class labels must map onto catalog part numbers and Rebrickable
color ids.

## Attribution and terms

Part and color data come from Rebrickable's downloads. Keep the credit line that the
build writes into `catalog.source.attribution`, and check the current terms at
<https://rebrickable.com/downloads/> before redistributing the raw dumps (this repo
commits only the curated 60-part subset, not the dumps).

LEGO is a trademark of the LEGO Group, which does not sponsor, authorize, or endorse
this project.
