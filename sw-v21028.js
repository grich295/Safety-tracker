const SHELL_CACHE='safety-shell-v21154-login-recovery';
const RUNTIME_CACHE='safety-runtime-v21154-login-recovery';

const SHELL=[
  './',
  './index.html',
  './styles-v21019.css',
  './config.js',
  './app-v21028.js',
  './hotfix-v21046-baseline.js',
  './hotfix-v21151-master-login-original-site.js',
  './hotfix-v21150-help-ppe-setup.js',
  './version.json',
  './manifest.webmanifest'
];

self.addEventListener('install',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>/^safety-(?:shell|runtime)-/i.test(k)).map(k=>caches.delete(k)));
    const cache=await caches.open(SHELL_CACHE);
    await Promise.all(SHELL.map(u=>cache.add(new Request(u,{cache:'reload'})).catch(()=>null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>/^safety-(?:shell|runtime)-/i.test(k)&&![SHELL_CACHE,RUNTIME_CACHE].includes(k)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch',event=>{
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.searchParams.has('offline-file'))return;

  // Never serve version/config from stale cache while online.
  const critical=url.origin===self.location.origin &&
    (url.pathname.endsWith('/version.json')||url.pathname.endsWith('/config.js'));

  if(event.request.mode==='navigate' || critical || url.origin===self.location.origin){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(new Request(event.request,{cache:'no-store'}));
        if(fresh && fresh.ok){
          const copy=fresh.clone();
          caches.open(SHELL_CACHE).then(c=>c.put(event.request,copy)).catch(()=>{});
        }
        return fresh;
      }catch(_e){
        const exact=await caches.match(event.request);
        if(exact)return exact;
        if(event.request.mode==='navigate')return (await caches.match('./index.html'))||Response.error();
        const name=url.pathname.split('/').pop();
        return (await caches.match('./'+name))||Response.error();
      }
    })());
    return;
  }

  event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
