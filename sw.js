const CACHE_VERSION='cnhs-hub-v8';
const CORE_CACHE=CACHE_VERSION+'-core';
const RUNTIME_CACHE=CACHE_VERSION+'-runtime';
const FIREBASE_CACHE=CACHE_VERSION+'-firebase';
const FONT_CACHE=CACHE_VERSION+'-fonts';

const CORE_ASSETS=[
  './',
  './index.html',
  './taskhub.html',
  './egrado.html',
  './attendtrack.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png'
];

const CDN_ASSETS=[
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js',
  'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js',
  'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css'
];

self.addEventListener('install',event=>{
  self.skipWaiting();
  event.waitUntil((async()=>{
    const core=await caches.open(CORE_CACHE);
    await Promise.all(CORE_ASSETS.map(u=>core.add(u).catch(()=>{})));
    const fb=await caches.open(FIREBASE_CACHE);
    await Promise.all(CDN_ASSETS.map(u=>fb.add(new Request(u,{mode:'no-cors'})).catch(()=>{})));
  })());
});

self.addEventListener('activate',event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(k=>!k.startsWith(CACHE_VERSION)).map(k=>caches.delete(k)));
    await self.clients.claim();
  })());
});

function isFirebaseData(url){
  return url.hostname.includes('firebaseio.com')||url.hostname.includes('firebaseapp.com')||url.hostname.includes('googleapis.com');
}
function isFont(url){
  return url.hostname.includes('fonts.googleapis.com')||url.hostname.includes('fonts.gstatic.com');
}
function isCDN(url){
  const h=url.hostname;
  return h.includes('gstatic.com')||h.includes('jsdelivr.net')||h.includes('cdnjs.cloudflare.com')||h.includes('cdn.sheetjs.com');
}
function isSameOrigin(url){
  return url.origin===self.location.origin;
}

async function networkFirst(request,cacheName){
  const cache=await caches.open(cacheName);
  try{
    const fresh=await fetch(request);
    if(fresh&&fresh.status===200) cache.put(request,fresh.clone()).catch(()=>{});
    return fresh;
  }catch(e){
    const cached=await cache.match(request);
    if(cached) return cached;
    throw e;
  }
}

async function cacheFirst(request,cacheName){
  const cache=await caches.open(cacheName);
  const cached=await cache.match(request);
  if(cached){
    fetch(request).then(r=>{if(r&&r.status===200) cache.put(request,r.clone()).catch(()=>{});}).catch(()=>{});
    return cached;
  }
  try{
    const fresh=await fetch(request);
    if(fresh&&(fresh.status===200||fresh.type==='opaque')) cache.put(request,fresh.clone()).catch(()=>{});
    return fresh;
  }catch(e){
    const any=await cache.match(request,{ignoreSearch:true});
    if(any) return any;
    throw e;
  }
}

async function staleWhileRevalidate(request,cacheName){
  const cache=await caches.open(cacheName);
  const cached=await cache.match(request);
  const network=fetch(request).then(r=>{if(r&&r.status===200) cache.put(request,r.clone()).catch(()=>{});return r;}).catch(()=>null);
  return cached||await network||Response.error();
}

self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET') return;
  const url=new URL(req.url);

  if(isFirebaseData(url)&&!isCDN(url)) return;

  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      try{
        const fresh=await fetch(req);
        const cache=await caches.open(CORE_CACHE);
        cache.put(req,fresh.clone()).catch(()=>{});
        return fresh;
      }catch(e){
        const cache=await caches.open(CORE_CACHE);
        const cached=await cache.match(req)||await cache.match('./index.html')||await cache.match('/index.html');
        if(cached) return cached;
        return new Response('<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Offline</title><style>body{font-family:system-ui;background:#030a24;color:#fff;display:grid;place-items:center;min-height:100vh;margin:0;padding:20px;text-align:center}.o{max-width:400px}h1{font-size:32px;margin-bottom:10px;color:#f97316}p{color:rgba(255,255,255,.7);line-height:1.6}</style></head><body><div class="o"><h1>You\'re offline</h1><p>This page isn\'t cached yet. Connect to the internet once and it\'ll be available offline next time.</p></div></body></html>',{headers:{'Content-Type':'text/html'}});
      }
    })());
    return;
  }

  if(isFont(url)){event.respondWith(cacheFirst(req,FONT_CACHE));return;}
  if(isCDN(url)){event.respondWith(cacheFirst(req,FIREBASE_CACHE));return;}
  if(isSameOrigin(url)){event.respondWith(staleWhileRevalidate(req,RUNTIME_CACHE));return;}
  event.respondWith(cacheFirst(req,RUNTIME_CACHE).catch(()=>fetch(req)));
});

self.addEventListener('message',event=>{
  if(event.data==='SKIP_WAITING') self.skipWaiting();
  if(event.data==='CLEAR_CACHES'){
    caches.keys().then(ks=>Promise.all(ks.map(k=>caches.delete(k))));
  }
});
