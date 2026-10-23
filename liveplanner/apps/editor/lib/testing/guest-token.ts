// A guest token's shape for tests (liveworkspace/docs/one-explorer-contracts.md "Guests"): the claims the editor
// reads, unsigned. The editor never checks the signature (the api and the index do), so a test needs none.
const b64url = (value: string) =>
  btoa(value).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

// A guest token for `id`, lapsing `lifeSeconds` from now (a year by default).
export function guestTokenFor(id: string, lifeSeconds = 365 * 24 * 3600): string {
  const header = b64url(JSON.stringify({ alg: 'ES256', typ: 'JWT' }));
  const claims = b64url(
    JSON.stringify({ sub: id, kind: 'guest', exp: Math.floor(Date.now() / 1000) + lifeSeconds }),
  );
  return `${header}.${claims}.sig`;
}
