# Holiday Display Explorer

A working mobile-first React + TypeScript + Vite application for discovering road-visible holiday displays and assembling family tours. No account required. The initial real dataset is deliberately empty; six original fictional examples are visibly labeled and cannot launch navigation.

## Run

Node 22.12+ (or current Node 24), then:

```sh
npm ci
npm run dev
npm test
npm run build
node scripts/preview.mjs
```

Production preview: http://127.0.0.1:4173/holiday-display-explorer/ . `dist/` is the deployable site. The preview uses a project subpath to exercise Pages deployment. The service worker runs only in production builds. Dependencies are locked in package-lock.json.

## Deploy to GitHub Pages

1. Push this directory's source to the intended GitHub repository, on `main`.
2. In repository Settings → Pages, select **GitHub Actions** as the build source.
3. The included `.github/workflows/deploy.yml` runs tests, builds, uploads `dist`, and deploys Pages. The workflow requires Pages availability and repository permissions.
4. Open the deployment URL shown by the workflow. HTTPS is needed for installation, location, and service workers.

Vite uses `base: './'`; all assets, manifest scope, start URL, and service-worker URLs are relative. Shared tour links use hash fragments rather than server-side routes, so project subpaths and reloads do not require a Pages rewrite. Do not deploy beneath arbitrary additional path segments. Source repository: https://github.com/jacobmgoodnight/Holiday-Display-Explorer . GitHub Pages must be enabled for this repository; private-repository Pages availability depends on the account plan. Local success does not imply an executed GitHub Actions deployment.

## What works

- Responsive list/map, seasonal and town/address/ZIP search, location request on demand, distance and residential/free/drive-by/music/family/open/unknown-hours filters.
- Full normalized display schema in `src/data.ts`, safe text rendering, HTTP(S)-only links, import validation, address/proximity duplicate merge, source retention, hours/date conflict flags.
- Manual discovery entry, coordinate extraction from long Maps links, CSV/JSON preview/import/export. Short links cannot be expanded in a static browser; open them in Maps and copy coordinates. Address-only records are saved but cannot route until coordinates are supplied through a reviewed import. Geocoding is not configured.
- Local favorites, saved tours with display snapshots, route progress, and season/demo preferences. Current start coordinates are persisted locally with the tour; location history is not recorded.
- Start by coordinates, map pin, or current location; optional ending coordinates or round trip; departure time (device timezone); per-stop viewing durations; desktop drag reorder plus mobile/keyboard up/down controls.
- Nearest-neighbor + 2-opt ordering, endpoint-aware asymmetric road matrices when configured, time-budget suggestions, arrivals, viewing and return time, closed-stop flags/removal. Results are estimates, not globally optimal solutions or live-traffic guarantees. Known windows are evaluated after ordering; the optimizer does not solve a time-window vehicle routing problem. Change departure/reorder/remove flagged stops as needed.
- Without roads, coordinate ordering works but driving distance/time, total duration, arrival checks, and budget assurance are explicitly unavailable. Suggested tours then budget viewing minutes only.
- Google Maps segments with at most three intermediate waypoints, preserving every stop and final endpoint. Individual Google/Apple navigation; progress survives returning. Demo navigation is blocked.
- Shared links include display stops and basic tour settings but omit private start/end coordinates, departure, and progress. Recipients choose their own start. Anyone with the link can read its display data; only share public displays.
- PWA manifest, PNG/SVG icons, iPhone installation guidance, optional install prompt, versioned app-shell/data precache, offline saved tour access. Map tiles are never service-worker cached or bulk downloaded.

## Data updates and ownership

`public/data/displays.json` is the reviewed public dataset. `examples/displays.json` shows all normal fields; `examples/displays.csv` is a compact example. Both contain fictional data only. Use Import in the app to validate, preview and export a JSON file, review its accuracy and permissions, then commit it to the repository. The UI cannot write to GitHub and has no pretend admin password. Imports are capped at 2 MB in the UI and 2,000 records in adapters.

Required fields: `id`, `name`. Use unique stable IDs. Unknown dates, coordinates, year, duration, music remain `null`; unknown hours are `[]`. CSV booleans are `true`/`false`; nested `hours`, `sources`, `photos`, `conflicts` require quoted JSON cells (JSON files are easier). Coordinates require both latitude and longitude. Sunday is day 0; hours are local `HH:mm`, including overnight windows, in the supplied IANA timezone.

`verification: "confirmed"` alone is insufficient: `year` and the year of `lastConfirmed` must match the current season. Import timestamps never confer confirmation. Older years show “From a previous season.” Conflicting records become unverified. Matching normalized address+town, or a matching name within 0.025 miles, merges sources and flags conflicting schedules. The first record's fields/ID are retained for owner review; conflicting values are not silently declared authoritative. Adjacent houses with different names are not proximity-merged. Fictional and real datasets never merge.

Photos are optional link metadata only: `{url, credit, permission, authorized: true}`. Permission must describe the actual grant; authorization is an owner responsibility, not proof created by a checkbox. No third-party photos, descriptions, or personal contact information are copied. Record explicit permissions outside the public dataset where appropriate.

Set `contactEmail` in `public/config.json` before publishing real records. Until supplied, the app honestly reports that homeowner contact is unavailable. An optional HTTPS `submissionUrl` may link to an existing reviewed form; submissions are never auto-published. Handle removal requests by deleting the record from the public dataset and deploying; visitors' independently saved copies may remain on their devices.

## Connected sources

**Indy with Kids Christmas and FrightMaps Indianapolis are connected through HTML parsers producing daily review snapshots, based on the owner's stated permission.** ChristmasPrism, Indy with Kids Halloween, and Indy Christmas Lights remain reference links only. CSV, JSON, manual entry and the static repository dataset are active inputs. See [source and provider research](docs/source-research.md). FrightMaps' general terms prohibit scraping; this integration relies on the owner's reported authorization, not a general mirror license. FrightMaps results are city-level only.

The adapter interface (`ImportAdapter`) allows future authorized feeds to normalize into the same schema. Only schedule a feed job after documenting credentials, license, attribution, limits, freshness and allowed fields. Validate before committing, review conflicts, keep last-imported separate from last-confirmed, and do not publish unreviewed submissions.

## Optional road routing

The frontend is free of secret keys. Set `routingEndpoint` in `public/config.json` to your deployed HTTPS worker URL. The endpoint accepts `POST { locations: [[longitude, latitude], ...] }` and returns `{durations: number[][], distances: number[][]}` in seconds and meters, preserving input order. Null/unreachable legs reject the estimate rather than receiving made-up travel times.

`serverless/worker.mjs` is an optional Cloudflare Worker proxy for openrouteservice's driving-car matrix. Set up a Worker account and an openrouteservice account; verify current plan eligibility. From `serverless/`, use the current official Wrangler CLI:

```sh
npx wrangler secret put ORS_API_KEY
npx wrangler deploy
```

Edit `ALLOWED_ORIGIN` in wrangler.toml to the exact Pages origin. The configured RATE_LIMITER binding is mandatory (5 requests/minute per IP); missing secrets/binding fail closed. CORS origin checks prevent ordinary cross-site browser use but are not authentication. Rate limiting is per Cloudflare location, not a global billing cap; apply provider quota limits, monitor usage, and add durable global budgets/Turnstile if traffic grows. Do not log coordinates or request bodies. No server cache is enabled. Client memory caches up to 20 coordinate matrices for 15 minutes and clears on reload. Requests use timeouts and up to 22 coordinates (20 stops plus endpoints). Confirm provider caching terms before changing this policy.

The selected free-tier candidate is openrouteservice; US coverage is OSM-based and local completeness varies. Current plan availability/quotas must be confirmed in the provider dashboard. Mapbox is an alternative with token and metered element billing; the existing adapter contract can support it. Neither provider is activated without credentials. No public demo routing server is used as a production dependency. Do not put private ORS secrets in VITE_* variables.

## Offline, privacy and costs

Static frontend + public GitHub Pages can operate without a paid server (subject to GitHub limits). OpenStreetMap's standard tiles need attribution, normal interactive traffic, and compliance with its usage policy; they have no production SLA. Configure a suitable tile provider before high-volume operation. Fonts load from Google Fonts online; system fallbacks work offline. No analytics or account database is included. Maps and configured routing see requests; external navigation has its own privacy policy.

The build creates a hashed precache manifest. The app shell, icons and site data load offline after successful first installation. Saved records/tours use localStorage and can be lost if browser storage is cleared or evicted. The app reports write failures. Maps, fresh road estimates and navigation require connectivity. Physical iPhone installation and navigation handoff should be checked on the target phone before launch.

## Verification

`npm test`: 24 automated tests cover seasonal labels, duplicate conflicts/proximity, missing points, CSV/JSON, unsafe URLs, timezone/overnight hours, route endpoints, viewing/return times, offline approximation, 20-stop navigation segmentation, private-start sharing, and routing failure.

Production build and `/holiday-display-explorer/` asset loading were tested locally. Browser checks include desktop and 390px mobile layout, favorites/selected stops surviving reload, and saved tour behavior. The included optional worker requires live credential testing; the optional live API has not been tested. GitHub Pages deployment succeeded on 2026-10-18. See [QA notes](docs/validation.md).

Modules: `data.ts` schema/imports; `route.ts` optimization/timeline/navigation/provider contract; `Map.tsx` Leaflet rendering; `App.tsx` interaction and local storage; `serverless/` optional private routing proxy. These boundaries can be reused behind a backend or native wrapper.



## Scheduled imports

The daily importer is active for Indy with Kids Christmas and FrightMaps Indianapolis. The combined snapshot contains 306 discoveries (167 and 139 respectively). Import offers source selection, network-first snapshot refresh, and a link to run a fresh scrape through the authenticated GitHub workflow. It publishes review snapshots, leaving the reviewed directory unchanged. See [feed setup](feeds/README.md). All 37 automated tests pass.


## Scraping, paste and personal contributions

See [scraping and contribution guide](docs/scraping-and-contributions.md). The first live scrape returned 167 previous-season discoveries. Load them from Import, review and add locally. Each display supports personal pictures, comments and ratings stored on the device. These are not public reviews. No scraped photos or editorial descriptions are copied.

