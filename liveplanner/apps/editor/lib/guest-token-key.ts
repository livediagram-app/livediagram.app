// Where the guest token is kept (lib/guest-token.ts). Its own module, free of browser code and client boundaries,
// so the root layout's inline grant script (app/pre-hydration-scripts.ts) can read the same key.
export const GUEST_TOKEN_STORAGE_KEY = 'liveplanner:v2:guest-token';
