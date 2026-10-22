// The pre-boot guard against stale HTML (docs/specs/016-platform/stale-builds.md "The pre-boot
// guard"): the first script in the editor's <head>, before any build asset, for an earlier build's
// page that still reaches the browser (a bfcache restore, a proxy that ignores no-store). That page
// names chunk files the last deploy removed and dies before React starts, so nothing in the app can
// help it; this can. One reload of the current URL, claimed from the one reload guard it shares with
// the running app's chunk recovery (reload-guard.ts), whose claim function it embeds. Once that
// recovery is installed (APP_RECOVERY_FLAG) the guard leaves runtime failures to it: the app waits
// for unsaved work before reloading, and this script cannot.
//
// A string in a plain module (not 'use client', nothing browser-only imported), as the other boot
// scripts are: the layout is a server component. ES5-safe and self-contained; every global is
// reached by name (window, document, location, sessionStorage, performance, fetch, Date, console,
// console), so a test can run it against stubs. Both of its lines are warnings, always shown: a reload
// is a recovery worth seeing (docs/specs/003-system-architecture/console-logging.md).
import { BUILD_ID_HEADER } from '@livediagram/api-schema';
import { API_BASE } from './api/base';
import {
  APP_RECOVERY_FLAG,
  RELOAD_GUARD_KEY,
  RELOAD_GUARD_WINDOW_MS,
  claimReloadIn,
} from './reload-guard';
/**
 * The guard's settings, as `data-*` attributes for its own <script> element (the layout spreads
 * them on). The script reads them back through `document.currentScript.dataset`: no value is ever
 * written into its source, which stays static. Strings, as attributes are.
 */
export const STALE_HTML_GUARD_ATTRIBUTES: Readonly<Record<string, string>> = {
  'data-reload-key': RELOAD_GUARD_KEY,
  'data-reload-window': String(RELOAD_GUARD_WINDOW_MS),
  'data-api': API_BASE,
  'data-build-header': BUILD_ID_HEADER,
  'data-app-flag': APP_RECOVERY_FLAG,
};

// Static source: one function's own code (the shared reload claim) and fixed
// text; every setting comes from the element's data. Without its data it does nothing at all.
export const STALE_HTML_GUARD_SCRIPT = `(function(){
var c=document.currentScript&&document.currentScript.dataset;if(!c||!c.reloadKey)return;
var KEY=c.reloadKey,WINDOW=Number(c.reloadWindow),API=c.api,HEADER=c.buildHeader,APP=c.appFlag;
var claim=${claimReloadIn.toString()};
function isAsset(u){return typeof u==='string'&&u.indexOf('/_next/static/')!==-1;}
var reloading=false;
function reloadOnce(reason,detail){
if(reloading)return;
if(!claim(sessionStorage,KEY,location.pathname+location.search,Date.now(),WINDOW)){console.warn('[stale-html] already reloaded this page; leaving it',detail);return;}
reloading=true;console.warn('[stale-html] '+reason+'; reloading',detail);location.reload();}
window.addEventListener('error',function(e){if(window[APP])return;var t=e&&e.target;if(!t||!t.tagName)return;
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
