// What the Appearance boot path needs (docs/specs/004-interface-design/appearance.md): the
// localStorage key, the OS media query and the pre-paint script, in a PLAIN module,
// deliberately NOT `'use client'`. Every app's root layout is a server component and
// inlines the script; a constant defined in a client module reaches the server as a
// client-reference stub whose text holds an apostrophe, which once broke the quoted
// key and threw on every page load, so dark mode never applied before paint.
//
// The key still SAYS ui-mode: it is stored data, not vocabulary. Renaming it would
// silently reset the preference for everyone who has ever set it.
export const APPEARANCE_STORAGE_KEY = 'livediagram:v2:ui-mode';

// The OS-level dark preference, read by the store at runtime and by the pre-paint
// script. Shared so the two cannot disagree about what System means.
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';

// Runs before first paint in every app. 'dark' paints dark, 'light' stays light, and
// anything else (System, nothing stored, a value this build does not know) defers to
// the device, because System is the default. Wrapped in try/catch: an exception here
// (storage denied) would take the rest of the inline boot with it.
export const APPEARANCE_BOOT_SCRIPT = `try{var s=localStorage.getItem('${APPEARANCE_STORAGE_KEY}');if(s==='dark'||(s!=='light'&&typeof matchMedia==='function'&&matchMedia('${DARK_MEDIA_QUERY}').matches))document.documentElement.classList.add('dark')}catch(e){}`;
