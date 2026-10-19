// Build replaces the precache placeholder with hashed application files.
const CACHE='hde-__BUILD__';
const SHELL=__PRECACHE__;
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(c=>c.addAll(SHELL))));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('hde-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin)return; // Never precache map tiles or provider requests.
 if(event.request.mode==='navigate'){event.respondWith(fetch(event.request).catch(()=>caches.match(new URL('./index.html',self.registration.scope).href)));return}
 if(/\/data\/(source-candidates|import-report)\.json$/.test(url.pathname)){
  event.respondWith(fetch(event.request).then(response=>{if(!response.ok)throw Error('Snapshot unavailable');const copy=response.clone();event.waitUntil(caches.open(CACHE).then(c=>c.put(event.request,copy)));return response}).catch(()=>caches.match(event.request).then(cached=>{if(!cached)return new Response('Snapshot unavailable offline',{status:503});const headers=new Headers(cached.headers);headers.set('X-HDE-Offline','1');return new Response(cached.body,{status:200,headers})})));return;
 }
 event.respondWith(caches.match(event.request).then(cached=>{const network=fetch(event.request).then(response=>{if(response.ok)caches.open(CACHE).then(c=>c.put(event.request,response.clone()));return response});if(cached){event.waitUntil(network.catch(()=>{}));return cached}return network}));
});
