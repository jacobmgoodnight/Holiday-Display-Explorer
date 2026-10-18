import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { z } from 'zod';
import { adapters, mergeDisplays } from '../src/data.ts';

export const feedSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,60}$/),
  name: z.string().min(1).max(200),
  enabled: z.boolean(),
  url: z.string().url().refine(v => {
    const u = new URL(v);
    return u.protocol === 'https:' && !u.username && !u.password && !u.search && !u.hash;
  }, 'Use a public HTTPS feed URL without credentials or query secrets'),
  format: z.enum(['json', 'csv']),
  attributionUrl: z.string().url().refine(v => v.startsWith('https://')),
  permission: z.string().min(1).max(2000),
  tokenEnv: z.string().regex(/^[A-Z][A-Z0-9_]+$/).optional(),
});
const MAX_BYTES = 2 * 1024 * 1024;

export async function fetchFeed(raw: unknown, request: typeof fetch = fetch, env = process.env) {
  const feed = feedSchema.parse(raw);
  if (!feed.enabled) return [];
  const token = feed.tokenEnv ? env[feed.tokenEnv] : undefined;
  if (feed.tokenEnv && !token) throw new Error(`${feed.id}: missing configured token`);
  // Do not follow redirects: credentials must only reach the configured origin.
  const response = await request(feed.url, {
    redirect: 'error', signal: AbortSignal.timeout(15000),
    headers: { Accept: feed.format === 'json' ? 'application/json' : 'text/csv',
      ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!response.ok) throw new Error(`${feed.id}: HTTP ${response.status}`);
  if (!response.body) throw new Error(`${feed.id}: empty response`);
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) throw new Error(`${feed.id}: exceeds 2 MB`);
      chunks.push(value);
    }
  } finally { await reader.cancel(); }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  const rows = adapters.find(a => a.id === feed.format)!.parse(new TextDecoder().decode(bytes));
  if (rows.some(d => d.demo)) throw new Error(`${feed.id}: demo rows are not allowed in live feeds`);
  return rows.map(d => ({ ...d, id: `${feed.id}:${d.id}`,
    lastImported: new Date().toISOString().slice(0, 10),
    sources: [...d.sources, { name: feed.name, url: feed.attributionUrl, recordId: d.id }],
  }));
}

export async function run() {
  const feeds = z.array(feedSchema).max(10).parse(JSON.parse(await readFile('feeds/sources.json', 'utf8')));
  if (new Set(feeds.map(f => f.id)).size !== feeds.length) throw new Error('Duplicate feed IDs');
  const enabled = feeds.filter(f => f.enabled);
  const records = [];
  const report = [];
  for (const feed of enabled) {
    try {
      const rows = await fetchFeed(feed);
      records.push(...rows);
      report.push({ source: feed.id, records: rows.length, status: 'fetched' });
    } catch {
      // Never print upstream errors that might contain URLs, tokens or response bodies.
      throw new Error(`${feed.id}: import failed; no candidate published. Check access, limits and schema.`);
    }
  }
  await mkdir('import-output', { recursive: true });
  await writeFile('import-output/candidate.json', JSON.stringify(mergeDisplays(records), null, 2));
  await writeFile('import-output/report.json', JSON.stringify({
    fetchedAt: new Date().toISOString(), status: enabled.length ? 'review-required' : 'no-authorized-feeds-configured',
    sources: report, records: mergeDisplays(records).length,
  }, null, 2));
  console.log(`${enabled.length} authorized feeds fetched; candidate requires owner review. Published data unchanged.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(error => { console.error(error.message); process.exitCode = 1; });
}
