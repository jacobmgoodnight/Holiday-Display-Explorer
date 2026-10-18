import { describe, it, expect } from 'vitest';
import { fetchFeed } from '../scripts/fetch-feeds';
const feed = { id: 'owner', name: 'Owner feed', enabled: true, url: 'https://example.org/feed.json', format: 'json', attributionUrl: 'https://example.org', permission: 'Test fixture only' };
const response = (body: string) => (async () => new Response(body)) as typeof fetch;
describe('scheduled feeds', () => {
  it('retains confirmation dates and unknown values while recording import attribution', async () => {
    const [d] = await fetchFeed(feed, response('[{"id":"one","name":"Test"}]'));
    expect(d.id).toBe('owner:one');
    expect(d.lastImported).toBe(new Date().toISOString().slice(0, 10));
    expect(d.lastConfirmed).toBeNull();
    expect(d.verification).toBe('unverified');
    expect(d.lat).toBeNull();
    expect(d.sources[0].name).toBe('Owner feed');
  });
  it('does not fetch disabled sources', async () => {
    expect(await fetchFeed({ ...feed, enabled: false }, async () => { throw Error('called'); })).toEqual([]);
  });
  it('rejects unconfigured authentication, unsafe URLs and malformed data', async () => {
    await expect(fetchFeed({ ...feed, tokenEnv: 'FEED_TOKEN' }, response('[]'), {})).rejects.toThrow('missing');
    await expect(fetchFeed({ ...feed, url: 'http://example.org' }, response('[]'))).rejects.toThrow();
    await expect(fetchFeed(feed, response('<html>not a feed</html>'))).rejects.toThrow();
    await expect(fetchFeed(feed, response('[{"id":"a","name":"A","demo":true}]'))).rejects.toThrow('demo');
  });
  it('bounds payloads and rejects server failures', async () => {
    await expect(fetchFeed(feed, response(' '.repeat(2097153)))).rejects.toThrow('2 MB');
    await expect(fetchFeed(feed, (async () => new Response('', {status:429})) as typeof fetch)).rejects.toThrow('429');
  });
});
