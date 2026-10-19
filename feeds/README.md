# Automatic feed imports

FrightMaps Indianapolis and Indy with Kids Christmas are now enabled based on the owner's reported permission. See [HTML adapters and refresh controls](../docs/scraping-and-contributions.md). The generic JSON/CSV guidance below applies to other feeds.

The daily GitHub Action and manual **Fetch authorized display feeds** action fetch approved feeds into a seven-day `display-import-review` artifact. Indy with Kids Christmas is active via its authorized HTML parser. See [scraping details](../docs/scraping-and-contributions.md). Other providers are not enabled; no undocumented endpoints are used.

After obtaining a supported feed and rights to republish its factual listings, add a configuration entry:

```json
{
  "id": "partner",
  "name": "Partner display directory",
  "enabled": true,
  "url": "https://your-provider.example/approved-feed.json",
  "format": "json",
  "attributionUrl": "https://your-provider.example/",
  "permission": "Reference to the provider's actual grant and allowed fields"
}
```

This is a configuration example, not an existing feed or permission grant. Only configure trusted public HTTPS endpoints. Feed URLs must not contain secrets; for bearer authentication add `tokenEnv` and map the matching GitHub Actions secret explicitly in the run step's `env`. Never commit tokens or permission documents containing private correspondence. Provider approval must cover data stored in public-repository Actions artifacts. Do not ingest private submissions through this public workflow.

Adapters accept the same normalized JSON array or CSV columns as the app's example imports. Custom provider responses need a documented adapter before enabling. Imports are sequential, one request per feed daily, at most ten feeds, 15-second timeouts and 2 MB/2,000-record limits. Redirects are rejected. There are no automatic retries or pagination; verify the approved endpoint provides a complete snapshot. Adjust scheduling only within provider quotas. Scheduled Actions can be delayed or disabled by GitHub after prolonged repository inactivity.

On any source failure the job fails without producing a fresh candidate or changing published data. Empty successful feeds remain visible as zero records in the report. Import dates do not update confirmation dates. All source links survive duplicate merging; conflicting schedules require review. A permission string documents your decision, it does not itself grant rights.

Download the artifact, inspect `report.json`, and use the app's Import preview to review `candidate.json`. Compare removals against the previous source snapshot; review duplicates, closed/old listings, consent and attribution. Merge approved records with your owner-maintained dataset, configure a homeowner contact, then commit `public/data/displays.json`. That commit triggers Pages deployment. The importer commits only the two public review-snapshot files and deploys them for local review. It does not modify the reviewed directory or publish user submissions.

Local run: `node --experimental-strip-types scripts/fetch-feeds.ts` (Node 22.12+). No-feed runs produce an explicit `no-authorized-feeds-configured` report and an empty candidate; they must never replace your published data.

