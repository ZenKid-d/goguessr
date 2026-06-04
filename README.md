# geo-guess

A GeoGuessr-style game for Android (and the browser) built on free, open data:
street-level **panoramas from Mapillary**, an open-source **MapLibre** guess map,
a **Svelte 5 + Tauri 2** client, and a **Rust + Axum** multiplayer server. Solo play
runs fully offline on the client; multiplayer is a small authoritative server you
run yourself and expose to friends over a tunnel.

> Hobby project for the author and friends — optimised for simple setup and free
> data sources, but kept architecturally clean and extensible.

## Status / roadmap

| Part | Scope                                                         | State                                                                                                      |
| ---- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| A    | Monorepo skeleton + cross-language game core (scoring, ts-rs) | ✅ done                                                                                                    |
| B    | Svelte 5 solo MVP (panorama + guess map + scoring)            | ✅ done                                                                                                    |
| C    | Tauri 2 + Android packaging + local storage (rusqlite)        | ✅ done (desktop compile verified; `android build` needs your SDK/NDK)                                     |
| D    | Axum WebSocket server + multiplayer rooms (server + client)   | ✅ done (run the server; see _Multiplayer_ below)                                                          |
| E    | Pool builder + world-capital seeds (`data/locations.json`)    | ✅ done (run `npm run build-pool` with your token)                                                         |
| F    | Android build polish + UX + Definition-of-Done pass           | 🚧 in progress (ESLint clean; SDK/NDK + `android init` done; `build` needs Developer Mode — see _Android_) |

## Prerequisites

- **Node.js ≥ 20** (developed on 24) and npm.
- **Rust** (stable, edition 2024) — only needed for the server / type generation / Tauri.
  - **Windows:** use the **MSVC** toolchain (`rustup default stable-x86_64-pc-windows-msvc`)
    with the **VS C++ Build Tools** installed. The GNU toolchain that ships without a
    full MinGW cannot compile `windows-sys` / native crates.
- A **Mapillary client access token** (`MLY|...`) — free, from the
  [Mapillary developer dashboard](https://www.mapillary.com/dashboard/developers).
  Required by the panorama viewer itself: **without a token, no panorama renders.**

## Quick start (solo, in the browser)

```bash
npm install                 # installs all workspaces
cp .env.example .env         # then edit .env and paste your MLY| token
npm run dev                  # vite dev server → http://localhost:5173
```

Open the URL, pick a mode in **Settings**, and press **Play solo**.

> **About the location pool:** the app loads `data/locations.json` if present,
> otherwise the committed `data/locations.sample.json`. The sample contains
> _placeholder_ image IDs that Mapillary cannot render — so until you build a real
> pool (Part E: `npm run build-pool`), panoramas will show a "could not load"
> state and you can **Skip**. To try real imagery sooner, drop a few real Mapillary
> image IDs into `data/locations.json` using the same schema as the sample.

## Building the location pool

Generate `data/locations.json` from the Mapillary API once, before playing with
real imagery:

```bash
MAPILLARY_TOKEN=MLY|... npm run build-pool
```

It walks ~190 world capitals (`tools/pool-builder/seeds.json`), samples small
bbox tiles (each < 0.01°, the API limit), keeps a few quality panoramas per city
(deduped by `sequence`), and prints a per-capital coverage report. Coverage is
very uneven — some capitals yield nothing; those are skipped, never fatal. If the
run collects zero locations it refuses to overwrite the existing pool.

Tunables (env vars):

| Var              | Default | Meaning                                  |
| ---------------- | ------- | ---------------------------------------- |
| `PER_SEED`       | 3       | locations kept per capital               |
| `TILES_PER_SEED` | 8       | bbox tiles sampled per capital           |
| `TILE_DEG`       | 0.008   | tile size in degrees (must stay < 0.01)  |
| `MIN_QUALITY`    | 0.2     | drop images below this `quality_score`   |
| `IMG_LIMIT`      | 40      | images requested per tile                |
| `DELAY_MS`       | 120     | pause between API requests               |
| `LIMIT_SEEDS`    | 0       | cap seeds processed (0 = all)            |
| `DRY_RUN`        | —       | skip the network; synthesize a tiny pool |

Add variety by appending cities to `seeds.json` (`{ name, country, lat, lng, radius_km }`).

## Project structure

```
geo-guess/
  apps/
    client/            # Svelte 5 + Vite + Tauri
      src-tauri/       # Rust shell: rusqlite local-storage commands + Android config
      src/
        lib/
          game/        # pure game logic: geo, scoring, session (no UI, unit-tested)
          mapillary/   # mapillary-js mode configuration
          map/         # maplibre-gl style (OSM raster default)
          net/bindings # ts-rs-GENERATED protocol types (do not edit by hand)
          stores/      # runes-based stores (router, settings, solo)
          storage/     # local persistence (rusqlite under Tauri, localStorage in the browser)
          pool/        # location pool loading + round selection
        components/    # PanoramaView, GuessMap, GameHud, RoundResult, Standings, ...
        routes/        # Menu, Settings, SoloGame screens
    server/            # Rust: protocol.rs (#[derive(TS)]) + authoritative scoring (Axum in Part D)
  tools/
    pool-builder/      # Node+TS pool generator (Part E)
    gen-scoring-vectors.mjs  # writes data/scoring-vectors.json (the scoring contract)
  data/
    locations.sample.json    # pool schema reference (committed)
    scoring-vectors.json     # shared TS/Rust scoring fixture (generated)
```

## Scripts (run from the repo root)

| Command                | What it does                                                     |
| ---------------------- | ---------------------------------------------------------------- |
| `npm run dev`          | Vite dev server for the client                                   |
| `npm run test`         | Rust tests + client Vitest                                       |
| `npm run check:client` | `svelte-check` (types for `.svelte` + `.ts`)                     |
| `npm run gen:bindings` | Regenerate `apps/client/src/lib/net/bindings/` from Rust (ts-rs) |
| `npm run gen:vectors`  | Regenerate the scoring fixture                                   |
| `npm run lint`         | `svelte-check` + ESLint + `clippy -D warnings`                   |
| `npm run lint:js`      | ESLint only (TypeScript + Svelte)                                |
| `npm run format`       | Prettier (write) + `cargo fmt`                                   |
| `npm run build:pool`   | Build `data/locations.json` from Mapillary (Part E; needs token) |

## Multiplayer

Multiplayer is a small **authoritative** server you run yourself; friends connect
to it by a short room code. The server owns the truth — it picks the locations,
sends each client only the `image_id` (never the coordinates), scores guesses,
and decides when each round closes (everyone answered, or the deadline passed).

### Run the server

```bash
cargo run -p server          # listens on ws://0.0.0.0:8787/ws
```

It loads the same pool as solo (`data/locations.json`, falling back to the sample),
so build a real pool first (Part E) for real imagery. Env: `PORT` (default 8787),
`POOL_PATH` (override the pool file).

### Let friends in (tunnel)

The server is on your machine; expose it over a tunnel so friends reach it from
anywhere (and so Android's default cleartext policy is satisfied with `wss://`):

```bash
cloudflared tunnel --url http://localhost:8787      # prints an https URL
# or: ngrok http 8787
```

Take the printed host and give everyone the **WebSocket** URL with the `/ws` path,
e.g. `wss://random-name.trycloudflare.com/ws`. Each player pastes it into
**Settings → Multiplayer server** (it's remembered). For same-machine browser
testing the default `ws://127.0.0.1:8787/ws` works as-is.

### Play

1. **Menu → Multiplayer.** Enter a display name.
2. **Create a room** (you're the host) — share the room code. Or **Join** with a code.
3. The host tunes settings (rounds, mode, difficulty, time limit, region) in the
   lobby, then **Start**. Everyone plays the same locations in lockstep; after each
   round you see the truth, everyone's pins and per-round scores; at the end, the
   final standings.

> **Disconnects:** by design a dropped socket means that player is **out** for the
> rest of the game (their score is kept in the standings). There is no reconnect
> token. To play again after a game, the host opens a **New room** and reshares the
> code — the room protocol is intentionally minimal (no persistent leaderboard).

## Running as an app (Tauri / Android)

The browser dev server is great for iteration, but the real target is a native
app. Tauri wraps the same frontend in a system WebView and adds the SQLite-backed
local storage (records, settings, history).

### Desktop (quick iteration)

```bash
npm -w apps/client run tauri dev      # builds the frontend + opens an app window
npm -w apps/client run tauri build    # produces an installer / binary
```

On Windows this needs **WebView2** (preinstalled on Windows 10/11) and the MSVC
build tools (see Prerequisites).

### Android

One-time host setup:

- **JDK 17** + **Android Studio** (for the SDK and platform-tools), or the
  command-line SDK tools.
- **Android SDK** (API 34) and **NDK** (26.x or 27.x — verified with `ndk;27.2.12479018`). Set:
  - `ANDROID_HOME` → SDK path (e.g. `%LOCALAPPDATA%\Android\Sdk`)
  - `NDK_HOME` → `%ANDROID_HOME%\ndk\<version>`
- Rust Android targets:
  ```bash
  rustup target add aarch64-linux-android armv7-linux-androideabi i686-linux-android x86_64-linux-android
  ```
- **Windows only — enable Developer Mode (required).** The Tauri Android build
  symlinks the compiled `.so` into the Gradle project's `jniLibs`, and Windows
  forbids creating symlinks without elevation _unless_ Developer Mode is on.
  Without it the build fails with _“Creation symbolic link is not allowed for
  this system.”_ Turn it on once: **Settings → Privacy & security → For
  developers → Developer Mode → On** (or run an **elevated** terminal and
  `reg add "HKLM\SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock" /v AllowDevelopmentWithoutDevLicense /t REG_DWORD /d 1 /f`).
  Alternatively, run the build commands from an Administrator terminal.

Then, from `apps/client`:

```bash
npm run tauri android init     # one-time: generates src-tauri/gen/android
npm run tauri android dev      # build + run on a connected device / emulator
npm run tauri android build    # build an APK / AAB
```

- **`INTERNET` permission:** Tauri's generated `AndroidManifest.xml` includes
  `android.permission.INTERNET` by default (the WebView needs it for Mapillary,
  map tiles, and the multiplayer WebSocket). After `android init`, confirm it in
  `src-tauri/gen/android/app/src/main/AndroidManifest.xml`.
- **Cleartext:** the multiplayer server should be reached over `wss://` (our
  default is a local server behind a Cloudflare/ngrok tunnel). Plain `ws://` to a
  LAN IP is blocked by Android's default cleartext policy unless you opt in.

### Sharing the APK with friends

`tauri android build` signs a **debug** APK with the auto-generated debug key —
enough to install and pass around for a hobby project. It lands under
`src-tauri/gen/android/app/build/outputs/apk/`. Install with:

```bash
adb install -r path/to/app-universal-debug.apk
```

For a "proper" distributable, create a release keystore and configure Gradle
`signingConfigs` under `src-tauri/gen/android` — optional, only if you want a
release-signed build.

## Architecture highlights

- **One source of truth for the wire protocol.** Message + settings types live once
  in Rust (`apps/server/src/protocol.rs`, `#[derive(TS)]`); `cargo test` regenerates
  the TypeScript in `apps/client/src/lib/net/bindings/`. The client imports only the
  generated types.
- **Scoring can't drift between languages.** The same haversine + exponential-decay
  formula exists in TypeScript (solo / instant feedback) and Rust (authoritative for
  multiplayer). Both are pinned to `data/scoring-vectors.json`, checked by Vitest
  **and** a Rust test — so if the two disagree, CI fails.
- **Game logic is UI-free and reused.** `apps/client/src/lib/game/` (geo, scoring,
  session state machine) has no Svelte in it; the runes stores wrap it.
- **Modes** map to mapillary-js components: `Move` (navigate + look), `NoMove`
  (look only), `NMPZ` (frozen frame).

## Attribution & licensing

- Mapillary imagery is **CC BY-SA**. The "© Mapillary" attribution in the viewer is
  **kept** (do not remove it). We use the official viewer/API; respect share-alike.
- The default guess map uses **OpenStreetMap** raster tiles (labels included, no key);
  attribution "© OpenStreetMap contributors" is shown. For heavier use, switch to
  MapTiler vector tiles via `VITE_MAPTILER_KEY`. (OSM's public tiles are fine for a
  small hobby app; don't hammer them.)
- **Never commit `.env`** or real tokens. The Mapillary client token is public by
  nature (it ships in the WebView), which is acceptable for client tokens.

## Known limitation — anti-cheat

Because the client renders by Mapillary `image_id`, a technically-minded player could
query the Mapillary API for that image's coordinates and cheat. For a game among
friends this is acceptable. Sending the client only the ID (never the coordinates)
removes the trivial cheat but not a determined one. Heavier measures (image
proxying/obfuscation) are out of scope; a possible future direction.
