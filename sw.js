const CACHE="sdv16-v8";
const ASSETS=["./","./index.html","./manifest.json"];
const CACHE="sdv16-v5";

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
  if(e.request.method!=="GET" ||
     new URL(e.request.url).origin!==location.origin)return;

  e.respondWith((async()=>{
    const url=new URL(e.request.url);

    if(url.pathname.endsWith("/voice-studio.js")){
      try{
        const r=await fetch(e.request,{cache:"no-store"});
        if(r.ok)return r;
      }catch{}
      return caches.match(e.request);
    }

    if(url.pathname==="/" || url.pathname.endsWith("/index.html")){
      let response;

      try{
        response=await fetch(e.request,{cache:"no-store"});
      }catch{
        response=await caches.match(e.request);
      }

      if(!response)return fetch(e.request);

      const html=await response.clone().text();

      if(html.includes("voice-studio.js"))return response;

      const injected=html.replace(
        /<\/body>/i,
        '<script src="./voice-studio.js?v=8"></script></body>'
      );

      const headers=new Headers(response.headers);
      headers.set("Content-Type","text/html; charset=utf-8");

      return new Response(injected,{
        status:response.status,
        statusText:response.statusText,
        headers
      });
    }

    const cached=await caches.match(e.request);
    if(cached)return cached;

    return fetch(e.request);
  })());
});
