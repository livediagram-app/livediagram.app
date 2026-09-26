// The two constants the Appearance boot path needs — the localStorage
// key and the OS media query — in a PLAIN module — deliberately NOT `'use client'`. The root layout is a
// server component and inlines this key into a pre-hydration `<script>`
// that applies the saved dark class before first paint (docs/specs/007-editor/live-app.md, no
// theme flash). Importing the key from the client `useAppearance` hook
// made Next substitute a client-reference stub ("Attempted to call …
// from the server") for the value; that stub's text contains an
// apostrophe, which broke the single-quoted script string and threw a
// SyntaxError on every page load (so dark mode never applied
// pre-hydration). A plain module has no client boundary, so the real
// string inlines.
//
// The key still SAYS ui-mode: it is stored data, not vocabulary. Renaming
// it would silently reset the preference for everyone who has ever set it.
export const APPEARANCE_STORAGE_KEY = 'livediagram:v2:ui-mode';

// The OS-level dark preference, read by the store at runtime and by the
// pre-hydration script before paint. Shared so the two can't drift onto
// different queries and disagree about what System means.
export const DARK_MEDIA_QUERY = '(prefers-color-scheme: dark)';
