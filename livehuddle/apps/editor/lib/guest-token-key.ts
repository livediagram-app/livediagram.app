// Where the guest token is kept (lib/guest-token.ts). Its own module, free of browser code and client boundaries,
// so an inline boot script can read the same key.
export const GUEST_TOKEN_STORAGE_KEY = 'livehuddle:v2:guest-token';
