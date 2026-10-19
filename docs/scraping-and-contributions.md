# Scraping and display contributions

## FrightMaps and refresh controls (2026-10-19)

The owner explicitly requested FrightMaps after reporting permission to read existing pages. Its public Indianapolis metro directory is now connected through `scripts/frightmaps-parser.ts`. The first combined fetch produced 139 FrightMaps discoveries and 167 Indy with Kids records (306 total). FrightMaps' general terms prohibit scraping; this adapter is enabled based on the owner's stated authorization, not on robots.txt alone. Remove/disable the adapter if that authorization is withdrawn or does not cover this use.

The FrightMaps adapter makes only two requests per run: robots.txt and the public `/metro/indianapolis` directory, with the same response limits, timeout, robots checks and throttling as the other source. It extracts names, towns, explicit admission labels, the directory year and source links. The directory year is not a confirmation year. Photos, descriptions, account endpoints, hidden location data and source ratings are not imported. Generic “Halloween Haunt” and “Halloween Display” labels do not prove residential or walk-through classification, so type remains unknown. Names that resemble street addresses are never used to reconstruct withheld locations. All imported FrightMaps coordinates and street addresses are unknown.

In **Import**, select either source or all sources, then **Refresh latest snapshot**. This makes network-first requests, shows the source scrape timestamp and warns when it is over 36 hours old. Offline access falls back to the last cached snapshot and labels it. Refreshing does not silently change the user's displays: review/edit/remove and then accept the candidate records. Matching local IDs are replaced on explicit acceptance; personal notes use stable IDs and are retained.

**Run a fresh scrape in GitHub (owner)** opens the import workflow. An authorized repository user chooses **Run workflow**. After scraping and deployment succeed, refresh the app snapshot. This is a real on-demand workflow, not a direct anonymous browser scrape or an exposed repository token. No optional backend or credentials are needed for these two public-page adapters. A future direct in-app trigger would require authenticated server-side access and rate limiting.

## Connected source

The owner reports permission to read existing pages and requested an Indy with Kids parser on 2026-10-18. `scripts/indy-parser.ts` parses the public Christmas guide's `article.light-card` structure. The initial successful fetch found 167 cards in the **2025** guide; seven were in Greenfield/McCordsville. This is the guide's default visible result set, not a claim to mirror all records in their system. The Halloween article and other directories are not connected.

`feeds/sources.json` activates this adapter. Once daily at 10:17 UTC (and manually from Actions), the importer checks robots.txt, downloads the guide and enriches at most 15 launch-area detail pages. It uses an identifying user agent, sequential requests, at least 1.5 seconds between details (respecting a longer crawl delay), 15-second request timeouts, 2 MB response caps, no redirects, no retries, no credentials and no browser automation. A denial, block, changed layout or incomplete fetch fails the job; the previous snapshot remains. The entire job has a five-minute deadline. GitHub may delay schedules or disable them after prolonged repository inactivity.

Names, addresses, explicit taxonomies and FM frequencies are extracted. Editorial descriptions, photos and personal contacts are excluded. No coordinates or dates are inferred. The source's generic “Verified / Active” label with no confirmation date does not become this year's confirmation. The guide title supplies the season year; missing year or cards fails closed. Missing fields stay unknown. This is not a geocoder: address-only entries have a Maps lookup link but cannot be optimized until the user confirms coordinates.

## Review snapshots

Successful imports create an artifact, commit `public/data/source-candidates.json` and `public/data/import-report.json`, and deploy the updated app. These two files are public review data, separate from the reviewed directory `displays.json`. The app's **Import → Load scraped discoveries** retrieves the snapshot; users can narrow it to the launch area, edit fields, remove records, download it or add it locally. Importing locally never writes to the repository. Source links and closure/conflict warnings remain visible. A snapshot's fetch date is shown separately from a display's confirmation date.

The workflow has repository contents-write permission solely to commit these snapshot files. It does not commit downloaded HTML, tokens or user submissions. A reusable deployment runs after the bot commit because GitHub's default workflow token does not trigger a new push workflow. Branch protection may require changing this to a reviewed PR flow. A scheduled run that races a source-code push fails its non-force git push; the next run refreshes safely.

## Paste and manual entry

Manual entry is available from **Add a display**. Saving opens the personal contributions dialog. **Import → Paste discoveries** supports JSON arrays, CSV beginning with `id,`, or blank-line-separated notes:

```text
Neighborhood lights
123 Example Road, Example Town
Town: Example Town
Season: Christmas
Year: 2025
Source: https://example.org/your-authorized-listing
```

This is fictional example data. Other optional labels are `Name:`, `Address:`, `Latitude:`, `Longitude:` and `Maps:`. Names, addresses and coordinates can be edited in the preview. Check coordinates before confirming an import. Pasted text is rendered as text; no HTML or scripts execute. Imported links use the existing URL validation.

## Pictures, comments and ratings

Every display card has **Pictures, comments & rating**. Contributions are personal, kept in IndexedDB on that device, not a public crowd-rating system. Each display supports one 1–5 rating (or unrated), up to 50 comments of 1,000 characters, and three photos. Users can remove entries and save changes. Photos accept JPEG/PNG/WebP up to 12 MB, are resized to 1,200 pixels, re-encoded as JPEG without EXIF, and capped at 450,000 data-URL characters each. HEIC must be converted first. Photo ownership/permission is explicitly acknowledged. Photos from authorized display imports can also be shown with attribution; the scraper never populates them.

Comments, ratings and local pictures are excluded from tour links and display exports. They survive reloads and work offline, but clearing browser storage or app local data removes them. Saving reports storage failures. Public contributions would require a configured backend, moderation and image storage; no such shared service is claimed or enabled.

Homeowner corrections can be requested through the repository's issue form (GitHub account required). Configure a contact email for a private, account-free alternative. No submission form or email service is configured, and scraped records are not automatically declared active.
