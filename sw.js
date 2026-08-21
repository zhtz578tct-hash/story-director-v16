const CACHE="sdv16-v5";
const ASSETS=["./","./index.html","./manifest.json","./voice-studio.js"];

self.addEventListener("install",e=>
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(ASSETS))
      .then(()=>self.skipWaiting())
  )
);

self.addEventListener("activate",e=>
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(
        keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))
      ))
      .then(()=>self.clients.claim())
  )
);

self.addEventListener("fetch",e=>{
  if(e.request.method!=="GET" || new URL(e.request.url).origin!==location.origin)return;
  e.respondWith((async()=>{
    const url=new URL(e.request.url);
    const cached=await caches.match(e.request);
    const response=cached||await fetch(e.request);
    const isHtml=url.pathname==="/" || url.pathname.endsWith("/index.html");
    if(!isHtml)return response;

    const html=await response.clone().text();
    if(html.includes("voice-studio.js"))return response;

    const injected=html.replace(/<\/body>/i,'<script src="./voice-studio.js"></script></body>');
    const headers=new Headers(response.headers);
    headers.set("Content-Type","text/html; charset=utf-8");
    return new Response(injected,{status:response.status,statusText:response.statusText,headers});
  })());
});
