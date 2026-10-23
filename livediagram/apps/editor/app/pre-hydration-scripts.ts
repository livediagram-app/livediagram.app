import { STORAGE_KEY as USER_PREFERENCES_STORAGE_KEY } from '@/lib/user-preferences';
import { silentSignInBootScript, silentCookiesForHint } from '@liveworkspace/auth-client/silent';
import { SIGNED_IN_HINT_COOKIE } from '@livediagram/api-schema';
import { API_BASE } from '@/lib/api/base';

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

// Signing in without a click (liveworkspace/docs/accounts.md "Signing in without a click"): once per browser
// session, a browser with no session here is bounced through the accounts site and straight back, signed in when
// it has a liveworkspace session and a guest when not. First in <head> (after Trusted Types), because when it
// bounces it stops the page loading, so nothing signed-out paints and no app code starts. Never on the sign-in
// pages, the guest hand-off's way back, the AI-tool consent pages, embeds; the shared script
// (@liveworkspace/auth-client/silent) also leaves frames, crawlers, share links and anyone who signed out of
// livediagram alone.
export const SILENT_SIGN_IN_SKIP_PATHS = [
  '/sign-in',
  '/get-started',
  '/auth',
  '/oauth',
  '/embed',
  '/workbench',
];
export const SILENT_SIGN_IN_BOOT_SCRIPT = silentSignInBootScript({
  apiBase: API_BASE,
  cookies: silentCookiesForHint(SIGNED_IN_HINT_COOKIE),
  skipPaths: SILENT_SIGN_IN_SKIP_PATHS,
});
