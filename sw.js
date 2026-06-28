/* Constellation — service worker (офлайн-оболочка) v3.
   Кэширует оболочку приложения и standalone-экраны (HTML/JS/CSS/иконки/CDN).
   Данные Supabase — МИМО SW (рулит приложение через IndexedDB/localStorage).
   v3: config.js network-first (ротация ключа без лага); прекеш и per-URL fallback экранов. */
var VER='constel-shell-v3';
var SCREENS=['./solve-home.html','./card.html','./explore.html','./concepts-browse.html',
             './situations.html','./findings.html','./quests.html','./access.html','./personal.html'];
var SAME=['./','./index.html','./config.js','./manifest.json','./icon-192.png','./icon-512.png'].concat(SCREENS);
var CDNS=[
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.108.2',
  'https://cdnjs.cloudflare.com/ajax/libs/marked/4.3.0/marked.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.4.8/purify.min.js'
];
function isCDN(u){ return u.indexOf('https://cdn.jsdelivr.net/')===0 || u.indexOf('https://cdnjs.cloudflare.com/')===0; }
function isSupabaseApi(u){ return /supabase\.co\/(rest|auth|realtime|storage|functions)\//.test(u); }
function isConfig(u){ try{ return new URL(u).pathname.replace(/^.*\//,'')==='config.js'; }catch(e){ return /\/config\.js(\?|$)/.test(u); } }

self.addEventListener('install', function(e){
  e.waitUntil(caches.open(VER).then(function(c){
    // свои файлы и экраны — обычный add (тот же origin); не валим установку на единичном 404
    var p1=Promise.all(SAME.map(function(u){ return c.add(new Request(u,{cache:'reload'})).catch(function(){}); }));
    // CDN — fetch no-cors + put вручную (cache.add падает на opaque-ответах)
    var p2=Promise.all(CDNS.map(function(u){ return fetch(new Request(u,{mode:'no-cors'})).then(function(r){ return c.put(u, r); }).catch(function(){}); }));
    return Promise.all([p1,p2]);
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
    e.respondWith(fetch(req).then(function(r){
      if(r&&r.status===200){ var cp=r.clone(); var pathKey=new URL(req.url).pathname; caches.open(VER).then(function(c){ c.put(pathKey, cp).catch(function(){}); }); }
      return r;
    }).catch(function(){
      // PER-URL fallback: отдаём ИМЕННО запрошенную страницу из кеша (игнорируя ?query),
      // а НЕ index.html — иначе прямая карточка сворачивается в монолит.
      return caches.match(req,{ignoreSearch:true}).then(function(m){
        return m || caches.match('./index.html').then(function(mi){ return mi || caches.match('./'); });
      });
    }));
    return;
  }

  if(isCDN(url)){                                        // CDN-скрипты — cache-first (put, opaque ок)
    e.respondWith(caches.match(req).then(function(m){
      return m || fetch(new Request(url,{mode:'no-cors'})).then(function(r){ var cp=r.clone(); caches.open(VER).then(function(c){ c.put(req,cp).catch(function(){}); }); return r; }).catch(function(){ return m; });
    }));
    return;
  }

  // прочие свои ассеты — stale-while-revalidate
  e.respondWith(caches.match(req).then(function(m){
    var net=fetch(req).then(function(r){ if(r&&r.status===200&&(r.type==='basic'||r.type==='cors')){ var cp=r.clone(); caches.open(VER).then(function(c){ c.put(req,cp).catch(function(){}); }); } return r; }).catch(function(){ return m; });
    return m || net;
  }));
});
