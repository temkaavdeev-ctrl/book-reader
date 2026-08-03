/* Constellation — service worker (офлайн-оболочка) v3.
   Кэширует оболочку приложения и standalone-экраны (HTML/JS/CSS/иконки/CDN).
   Данные Supabase — МИМО SW (рулит приложение через IndexedDB/localStorage).
   v3: config.js network-first (ротация ключа без лага); навигации stale-while-revalidate
   (мгновенно из кеша + обновление в фоне) с явным пушем NEW_VERSION при смене ETag. */
var VER='constel-shell-v5';
var SCREENS=['./path.html','./solve-home.html','./card.html','./explore.html','./concepts-browse.html',
             './situations.html','./findings.html','./quests.html','./access.html','./personal.html','./frontier.html'];
// зависимости вендорятся локально (vendor/) — same-origin: supply-chain + надёжность в RU-сетях + честный кеш вместо opaque
var VENDOR=['./vendor/marked.min.js','./vendor/purify.min.js','./vendor/supabase.min.js'];
var SAME=['./','./index.html','./config.js','./manifest.json','./icon-192.png','./icon-512.png'].concat(SCREENS).concat(VENDOR);
function isSupabaseApi(u){ return /supabase\.co\/(rest|auth|realtime|storage|functions)\//.test(u); }
function isConfig(u){ try{ return new URL(u).pathname.replace(/^.*\//,'')==='config.js'; }catch(e){ return /\/config\.js(\?|$)/.test(u); } }

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(VER).then(function(c){
    // свои файлы, экраны и вендоренные либы — обычный add (тот же origin); не валим установку на единичном 404
    return Promise.all(SAME.map(function(u){ return c.add(new Request(u,{cache:'reload'})).catch(function(){}); }));
  }));
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.map(function(k){ if(k!==VER) return caches.delete(k); }));
  }).then(function(){ return self.clients.claim(); }));
});

self.addEventListener('message', function(e){ if(e.data && e.data.type==='SKIP_WAITING') self.skipWaiting(); });

self.addEventListener('fetch', function(e){
  var req=e.request; if(req.method!=='GET') return;
  var url=req.url;
  if(isSupabaseApi(url)) return;                         // Supabase API — мимо SW (данными рулит приложение)

  // config.js — NETWORK-FIRST: ротация publishable-ключа доходит без лага; кеш только как офлайн-резерв
  if(isConfig(url)){
    e.respondWith(fetch(new Request(url,{cache:'no-store'})).then(function(r){
      if(r&&r.status===200){ var cp=r.clone(); caches.open(VER).then(function(c){ c.put(req,cp).catch(function(){}); }); }
      return r;
    }).catch(function(){ return caches.match(req).then(function(m){ return m || caches.match('./config.js'); }); }));
    return;
  }

  if(req.mode==='navigate'){                             // навигации (в т.ч. deep-link на standalone-экраны)
    // STALE-WHILE-REVALIDATE: мгновенно из кеша, свежак тянем в фоне и кладём в кеш.
    // Если ETag/Last-Modified фонового ответа отличается от закешированного — шлём клиентам
    // NEW_VERSION (приложение показывает плашку «Доступна новая версия»). Авто-reload нет — по клику.
    var pathKey=new URL(req.url).pathname;
    e.respondWith(caches.open(VER).then(function(cache){
      return cache.match(pathKey,{ignoreSearch:true}).then(function(cached){
        var revalidate=fetch(req,{cache:'no-cache'}).then(function(r){
          if(r&&r.status===200){
            if(cached){
              var oldTag=cached.headers.get('etag')||cached.headers.get('last-modified')||'';
              var newTag=r.headers.get('etag')||r.headers.get('last-modified')||'';
              if(oldTag&&newTag&&oldTag!==newTag){
                self.clients.matchAll().then(function(cs){ cs.forEach(function(c){ c.postMessage({type:'NEW_VERSION'}); }); });
              }
            }
            cache.put(pathKey, r.clone()).catch(function(){});
          }
          return r;
        }).catch(function(){ return null; });
        if(cached){ e.waitUntil(revalidate); return cached; }   // мгновенно из кеша + фоновое обновление
        // первый визит/нет кеша — ждём сеть; офлайн-резерв: запрошенная страница → index.html → корень
        return revalidate.then(function(r){
          return r || cache.match(req,{ignoreSearch:true}).then(function(m){ return m || cache.match('./index.html').then(function(mi){ return mi || cache.match('./'); }); });
        });
      });
    }));
    return;
  }

  // прочие свои ассеты (вкл. vendor/*.js) — stale-while-revalidate
  e.respondWith(caches.match(req).then(function(m){
    var net=fetch(req).then(function(r){ if(r&&r.status===200&&(r.type==='basic'||r.type==='cors')){ var cp=r.clone(); caches.open(VER).then(function(c){ c.put(req,cp).catch(function(){}); }); } return r; }).catch(function(){ return m; });
    return m || net;
  }));
});
