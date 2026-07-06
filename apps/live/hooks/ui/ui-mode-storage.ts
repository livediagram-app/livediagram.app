// The UI-mode (light / dark chrome) localStorage key, in a PLAIN module
// — deliberately NOT `'use client'`. The root layout is a server
// component and inlines this key into a pre-hydration `<script>` that
// applies the saved dark class before first paint (spec/07, no theme
// flash). Importing the key from the client `useUiMode` hook made Next
// substitute a client-reference stub ("Attempted to call … from the
// server") for the value; that stub's text contains an apostrophe,
// which broke the single-quoted script string and threw a SyntaxError
// on every page load (so dark mode never applied pre-hydration). A
// plain module has no client boundary, so the real string inlines.
export const UI_MODE_STORAGE_KEY = 'livediagram:v2:ui-mode';
