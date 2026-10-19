# Validation notes

- `npm test`: 24 passing automated tests; no live service credentials used.
- `npm run build`: TypeScript and production Vite build pass. Hashed PWA assets and relative URLs emitted.
- `npm audit` following test-runner update: 0 reported vulnerabilities.
- Production preview serves under `/holiday-display-explorer/`, exercising project-subpath asset loading.
- Browser UI verified: desktop map/list rendering with OSM attribution; 390px mobile list with bottom navigation and large controls; two stops added to a tour; favorite and tour selection retained after reload; approximate optimization; saved-tour control and demo-navigation blocking.
- Source records are not real listings. No fabricated private addresses or active-season claims.
- Pending deployment checks: GitHub Actions run on the chosen repository, live worker with ORS credentials, physical iPhone Add to Home Screen and Apple/Google navigation handoff. The app reloaded successfully with the origin server stopped, exercising the service-worker shell fallback; complete airplane-mode behavior and native installation still require a physical device check. All 12 precached asset paths exist.
- Address geocoding is not configured. Address-only records remain usable in the list; coordinates/map pin/current location are required for routes.
- No live third-party display imports or scheduled scraping jobs exist. Source status is documented individually in source-research.md.

## Scraping and contributions update

37 tests pass. Live fetches returned 167 Indy with Kids and 139 FrightMaps records. Mobile 390px checks verified snapshot import, editable paste preview, and persistence of a test rating, comment and uploaded app-icon image after reload (test contributions then removed). Tests cover changed layouts, duplicate IDs, unsafe links, missing years, and avoiding hidden coordinates and copied photos. Production build passed with Vite's runner config loader due the local sandbox's ancestor-directory restriction. Physical iPhone photo selection remains untested.

