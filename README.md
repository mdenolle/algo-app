# Algo

Algo is Alex's first coding project: a friendly, visual app that turns the building bricks a child already owns into new creations and step-by-step build books.

## Android app (start here)

The real phone project is in `mobile/`. It is an Expo/React Native app, so Android comes first while the same project can support iPhone later.

To run it on an Android phone:

1. Install **Expo Go** from the Google Play Store.
2. Connect the phone and this computer to the same Wi-Fi.
3. In `mobile/`, run `npm start`.
4. Open Expo Go on Android and scan the QR code.

The Android version includes the phone camera, three design choices, the top-and-bottom builder, Creator Mode, and the instruction-book cover.

## Share with friends

- **Nearby test:** friends install Expo Go, join the same Wi-Fi as the development computer, and scan the running project's QR code.
- **Remote test:** start Expo with tunnel mode and share the temporary QR code. The development computer must stay running.
- **Standalone Android app:** create an internal-distribution APK. Friends install Algo from the private download link and see Algo's own app icon instead of Expo Go. A parent should control the build account and distribution list.

## Real LEGO pieces

Algo's pieces are real LEGO parts. `catalog/` builds a verified list (part number,
official name, official colors, element ids) from Rebrickable's public data dumps,
and both the browser prototype and the Android app read it. Alex's demo inventory
is, for example, six Blue Brick 2 x 4 (part 3001), eight Red Brick 2 x 2 (3003) and
four Black Wheel 11 x 12 (6014b). See [catalog/README.md](catalog/README.md) to
refresh the data or add parts.

```sh
npm run catalog:build   # refresh from Rebrickable
npm test                # catalog invariants
```

## Algo World (round LEGO planet)

`world/` is the LEGO survival game: a spherical planet with streamed chunks,
procedural plains/ice/ocean terrain and instanced LEGO bricks, walked in third
person. You dig and build with a hotbar, you have one life, water drowns you,
you must eat apples, and the planet is saved in the browser. `npm install` once at the repo root (three.js), then
`npm run web` and open `http://localhost:8000/world/`, or play the published version
at **https://mdenolle.github.io/algo-app/world/** (every push to `main` republishes it,
see `.github/workflows/pages.yml`). In the Android app, tap **Explore Algo World** on the
home screen: it opens the published site in a WebView with touch controls, so the
laptop can be off; set `EXPO_PUBLIC_WORLD_URL=lan` in `mobile/.env` to load it from the
laptop while developing.
See [world/README.md](world/README.md) for the architecture and what comes next.

`npm run web` runs `serve.mjs`, a small Node server that sends no-cache headers so
the phone and the laptop always get the current files. If the phone shows "Algo
World is not reachable" while it is running, click **Allow** in the macOS firewall
dialog for `node`.

## Browser prototype

From this folder, run:

```sh
npm run web
```

Then open `http://localhost:8000` in a browser. Use the browser's mobile/device preview to see the phone layout.

## What works in the prototype

- Phone-camera/photo picker interface
- Demonstration piece scan
- Three build ideas based on a sample inventory
- Top-and-bottom guided building screen
- Interactive Creator Mode
- Friendly voice, French joke, hints, celebrations
- Personalized build-book cover preview

The piece recognition, generated 3D instructions, user accounts, bilingual interface, and print ordering are intentionally marked for later versions.

## Interchangeable AI scanner

The Android scan button now uses a provider interface in `mobile/src/vision/`.
Algo can switch among these without changing its screens or build logic:

- `demo` — the safe sample inventory used by the current prototype.
- `on-device` — an open-source model packaged inside the Android app. The photo
  can stay on the phone and there is no per-scan API bill.
- `remote` — a model running behind a parent-controlled web endpoint.

Copy `mobile/.env.example` to `mobile/.env.local` and change
`EXPO_PUBLIC_VISION_PROVIDER`. The model runner must always return the common
`VisionResult` shape: detected color, shape, name, count, and optional
confidence for every piece type.

For the first real on-device experiment, use a small custom object detector
trained on the LEGO shapes Algo supports. A detector is better suited to
locating and counting many small pieces than a general chat model. Export it to
an Android runtime such as ExecuTorch or LiteRT, then connect its native bridge
with `registerOnDeviceVisionRunner()`.

A small open vision-language model such as
`HuggingFaceTB/SmolVLM2-256M-Video-Instruct` can be tested as a second opinion
or for explaining uncertain pieces, but it should not be trusted as the sole
inventory counter until it passes a photo test set.

Important: custom native AI runtimes cannot run inside the standard Expo Go
app. The on-device provider requires an Expo development build or standalone
Algo APK. The demo and remote providers continue to work with Expo Go.
