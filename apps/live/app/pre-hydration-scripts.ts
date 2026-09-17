import { APPEARANCE_STORAGE_KEY, DARK_MEDIA_QUERY } from '@/hooks/ui/appearance-storage';
import { STORAGE_KEY as USER_PREFERENCES_STORAGE_KEY } from '@/lib/user-preferences';

// The two snippets the root layout inlines into `<script>` tags that run
// BEFORE first paint. They live here, as strings in a plain module, for two
// reasons: the layout stays readable, and — more importantly — the source is
// reachable from a test, which runs it against stub globals. What matters
// about these is not their text but which stored value ends up painting dark,
// and that is only assertable by executing them.
//
// Deliberately NOT `'use client'`, and neither is anything it imports: the
// layout is a server component, and a client boundary anywhere in this import
// chain hands it a client-reference stub instead of the real string. That is
// not hypothetical — it happened, and the stub's apostrophe closed the quoted
// key early and threw on every page load (see appearance-storage.ts).
//
// Both are wrapped in try/catch: they run before hydration, so an exception
// here (Safari private mode, a blocked storage context) would take the rest of
// the inline boot with it.

// Appearance (spec/07). 'dark' paints dark, 'light' stays light, and anything
// else — 'system', nothing stored at all, or a value this build doesn't know —
// defers to the device, because System is the default. That last case is the
// one that matters most here: it is EVERY first-time visitor, so a dark-machine
// reader has to land dark before the first paint rather than flash white.
export const APPEARANCE_BOOT_SCRIPT = `try{var s=localStorage.getItem('${APPEARANCE_STORAGE_KEY}');if(s==='dark'||(s!=='light'&&typeof matchMedia==='function'&&matchMedia('${DARK_MEDIA_QUERY}').matches))document.documentElement.classList.add('dark')}catch(e){}`;

// Reduce motion (spec/20). Same reason as the appearance script: the class has
// to be on <html> by the time elements mount, or their one-shot pop-in /
// fly-up-in animations have already fired before a React effect could add it.
// The OS prefers-reduced-motion query in globals.css needs no JS; this only
// covers the user's own override.
export const REDUCE_MOTION_BOOT_SCRIPT = `try{var p=JSON.parse(localStorage.getItem('${USER_PREFERENCES_STORAGE_KEY}')||'{}');if(p&&p.reduceMotion===true)document.documentElement.classList.add('reduce-motion')}catch(e){}`;
