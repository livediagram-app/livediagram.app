// The pre-boot guard against stale HTML (docs/specs/016-platform/stale-builds.md "The pre-boot
// guard"): the first script in the editor's <head>, before any build asset, for an earlier build's
// page that still reaches the browser (a bfcache restore, a proxy that ignores no-store). That page
// names chunk files the last deploy removed and dies before React starts, so nothing in the app can
// help it; this can. One reload of the current URL, at most once per URL in a short window.
//
// A string in a plain module (not 'use client', nothing browser-only imported), as the other boot
// scripts are: the layout is a server component. ES5-safe and self-contained; every global is
// reached by name (window, document, location, sessionStorage, performance, fetch, Date, console),
// so a test can run it against stubs.
import { BUILD_ID_HEADER } from '@livediagram/api-schema';
import { API_BASE } from './api/base';

/** One guard reload per URL within this window; a second failure leaves the page as it is. */
export const STALE_HTML_RELOAD_WINDOW_MS = 60_000;

const RELOADS_KEY = 'livediagram:stale-html-reloads';

export const STALE_HTML_GUARD_SCRIPT = `(function(){
var KEY=${JSON.stringify(RELOADS_KEY)},WINDOW=${STALE_HTML_RELOAD_WINDOW_MS},API=${JSON.stringify(API_BASE)},HEADER=${JSON.stringify(BUILD_ID_HEADER)};
function isAsset(u){return typeof u==='string'&&u.indexOf('/_next/static/')!==-1;}
var reloading=false;
function reloadOnce(reason,detail){
if(reloading)return;
var here=location.pathname+location.search,now=Date.now(),seen;
try{try{seen=JSON.parse(sessionStorage.getItem(KEY)||'{}')||{};}catch(e){seen={};}
if(typeof seen[here]==='number'&&now-seen[here]<=WINDOW){console.warn('[stale-html] already reloaded this page; leaving it',detail);return;}
seen[here]=now;sessionStorage.setItem(KEY,JSON.stringify(seen));}catch(e){return;}
reloading=true;console.info('[stale-html] '+reason+'; reloading',detail);location.reload();}
window.addEventListener('error',function(e){var t=e&&e.target;if(!t||!t.tagName)return;
var tag=String(t.tagName).toUpperCase(),url=tag==='SCRIPT'?t.src:tag==='LINK'?t.href:null;
if(isAsset(url))reloadOnce('a build asset failed to load',url);},true);
document.addEventListener('DOMContentLoaded',function(){
var links=document.querySelectorAll('link[rel="stylesheet"]');
for(var i=0;i<links.length;i++){if(isAsset(links[i].href)&&!links[i].sheet){reloadOnce('a build asset failed to load',links[i].href);return;}}
var entries=performance&&performance.getEntriesByType?performance.getEntriesByType('resource'):[];
for(var j=0;j<entries.length;j++){if(isAsset(entries[j].name)&&entries[j].responseStatus>=400){reloadOnce('a build asset failed to load',entries[j].name);return;}}});
window.addEventListener('pageshow',function(e){if(!e||!e.persisted)return;
var meta=document.querySelector('meta[name="livediagram-build"]'),own=meta&&meta.content;if(!own)return;
fetch(API+'/capabilities',{cache:'no-store'}).then(function(r){var live=r.headers.get(HEADER);
if(live&&live!==own)reloadOnce('a newer build is live than this restored page',live);}).catch(function(){});});
})();`;
