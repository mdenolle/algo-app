# Algo's voice

Algo speaks with a kid's voice: Alex's. Every line Algo says has an id; record the
line once, drop the file here, and all three places that talk (the Android app,
the web prototype, Algo World) play the recording. Lines with no recording keep
the computer voice, so you can record one line at a time.

## Record (5 minutes, laptop or phone)

1. Start the server (`npm run web` in `algo-app`) and open
   **http://localhost:8000/voice/record.html** (on the phone: the laptop's address, e.g.
   `http://192.168.86.140:8000/voice/record.html`).
2. For each line: **Record**, wait for "Go!", say it, **Stop**, **Play** to check, **Save**.
   The file lands in Downloads as `<id>.webm` (Chrome) or `<id>.m4a` (Safari).
   Start with `greeting`: "Hi! I'm Algo. Let's build something amazing!"
3. Move the files into `algo-app/voice/clips/`.
4. Run `npm run voice` in `algo-app`. It prints what is recorded and what is missing.
5. Reload the web page; restart `npm start` in `mobile/` for the Android app.

Voice Memos works too: record, export as `.m4a`, name it after the line id.

## Which file for which line

The list is `voice/lines.json` (id, text, where it is heard). Add a line there and
run `npm run voice`; `mobile/src/voice/lines.ts` is generated from it.

## Formats

`.m4a` is best (plays on Android, iPhone and every browser). `.webm` from Chrome
plays on Android and in browsers, not on iPhone. If you ever need to convert:
`afconvert -f m4af -d aac in.aiff out.m4a` on the Mac, or `ffmpeg -i in.webm out.m4a`.

## How it is wired

| Place | Code |
|---|---|
| Android app | `mobile/src/voice/player.ts` registers a clip player over `expo-audio`; `clips.generated.ts` holds the `require()` map; clips are copied to `mobile/assets/voice/` |
| Web prototype | `app.js` `say(text, lineId)` plays `voice/clips.js` entries with `<audio>` |
| Algo World | `world/src/voice.js`, same map; says `world-welcome` on Play, `world-gameover`, `world-apple` |
