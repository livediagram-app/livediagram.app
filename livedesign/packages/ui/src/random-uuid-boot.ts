// `crypto.randomUUID` outside a secure context (docs/specs/016-platform/secure-context.md). Browsers expose it only on
// HTTPS or localhost, and only when every frame above is secure too, so an embed on a plain-http wiki or a
// self-hosted instance on a LAN address threw "crypto.randomUUID is not a function" while it booted and showed
// "This page couldn't load". `getRandomValues` is there in every context, so this mints the same RFC 4122 version 4
// ids from it. Each app that mints ids in the browser (the editor) inlines it first in its layout, before
// any app code; a browser that has the real one keeps it. A plain string in a module with no client boundary, like
// the appearance script, so a server layout gets the real source.
export const RANDOM_UUID_BOOT_SCRIPT = `try{var c=typeof crypto==='object'?crypto:null;if(c&&typeof c.randomUUID!=='function'&&typeof c.getRandomValues==='function'){c.randomUUID=function(){var b=c.getRandomValues(new Uint8Array(16)),h='';b[6]=b[6]&15|64;b[8]=b[8]&63|128;for(var i=0;i<16;i++){h+=(b[i]+256).toString(16).slice(1);if(i===3||i===5||i===7||i===9)h+='-'}return h}}}catch(e){}`;
