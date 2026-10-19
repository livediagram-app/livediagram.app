import { STORAGE_KEY as USER_PREFERENCES_STORAGE_KEY } from '@/lib/user-preferences';

// The editor-only snippet the root layout inlines into a `<script>` that runs
// BEFORE first paint (the appearance one is shared by every app and lives in
// @livediagram/ui). It lives here, as a string in a plain module, so the layout
// stays readable and a test can reach the source.
//
// Deliberately NOT `'use client'`, and neither is anything it imports: the
// layout is a server component, and a client boundary anywhere in this import
// chain hands it a client-reference stub instead of the real string. That is
// not hypothetical — it happened, and the stub's apostrophe closed the quoted
// key early and threw on every page load (see packages/ui/src/appearance/appearance-storage.ts).
//
// Wrapped in try/catch: it runs before hydration, so an exception
// here (Safari private mode, a blocked storage context) would take the rest of
// the inline boot with it.

// Reduce motion (docs/specs/007-editor/user-preferences.md). Same reason as the appearance script: the class has
// to be on <html> by the time elements mount, or their one-shot pop-in /
// fly-up-in animations have already fired before a React effect could add it.
// The OS prefers-reduced-motion query in globals.css needs no JS; this only
// covers the user's own override.
export const REDUCE_MOTION_BOOT_SCRIPT = `try{var p=JSON.parse(localStorage.getItem('${USER_PREFERENCES_STORAGE_KEY}')||'{}');if(p&&p.reduceMotion===true)document.documentElement.classList.add('reduce-motion')}catch(e){}`;

// Webfonts without holding up first paint (docs/specs/004-interface-design/fonts.md "Loading"). The
// Google Fonts stylesheet is linked as `media="print"`, which the browser fetches at low priority
// without blocking render; this snippet, inlined right after the link, switches it to every medium
// once it has loaded. Text paints in the fallback face until then, exactly as `display=swap`
// already paints it while a face downloads, and useFontEpoch re-measures as the faces land.
export const WEBFONTS_STYLESHEET_ID = 'livediagram-webfonts';
export const WEBFONTS_SWAP_SCRIPT = `try{var l=document.getElementById('${WEBFONTS_STYLESHEET_ID}');if(l){var on=function(){l.media='all'};if(l.sheet)on();else l.addEventListener('load',on)}}catch(e){}`;

// `crypto.randomUUID` outside a secure context (docs/specs/016-platform/secure-context.md). Browsers expose it only on
// HTTPS or localhost, and only when every frame above is secure too, so an embed on a plain-http wiki or a
// self-hosted instance on a LAN address threw "crypto.randomUUID is not a function" while it booted and showed
// "This page couldn't load". `getRandomValues` is there in every context, so this mints the same RFC 4122 version 4
// ids from it. It runs first, before any app code; a browser that has the real one keeps it.
export const RANDOM_UUID_BOOT_SCRIPT = `try{var c=typeof crypto==='object'?crypto:null;if(c&&typeof c.randomUUID!=='function'&&typeof c.getRandomValues==='function'){c.randomUUID=function(){var b=c.getRandomValues(new Uint8Array(16)),h='';b[6]=b[6]&15|64;b[8]=b[8]&63|128;for(var i=0;i<16;i++){h+=(b[i]+256).toString(16).slice(1);if(i===3||i===5||i===7||i===9)h+='-'}return h}}}catch(e){}`;
