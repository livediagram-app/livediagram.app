import { appearanceBootScript, DARK_MEDIA_QUERY } from '@liveworkspace/ui/appearance-storage';

// What the Appearance boot path needs (docs/specs/004-interface-design/appearance.md): this product's
// localStorage key and the pre-paint script bound to it, in a PLAIN module, deliberately NOT `'use client'`.
// Every app's root layout is a server component and inlines the script; a constant defined in a client
// module reaches the server as a client-reference stub whose text holds an apostrophe, which once broke the
// quoted key and threw on every page load, so dark mode never applied before paint. The script itself is
// @liveworkspace/ui's (appearanceBootScript).
//
// The key still SAYS ui-mode: it is stored data, not vocabulary. Renaming it would
// silently reset the preference for everyone who has ever set it.
export const APPEARANCE_STORAGE_KEY = 'livediagram:v2:ui-mode';

export { DARK_MEDIA_QUERY };

// Runs before first paint in every app (see appearanceBootScript).
export const APPEARANCE_BOOT_SCRIPT = appearanceBootScript(APPEARANCE_STORAGE_KEY);
