// The accounts Worker as an e2e stack's api reaches it over its ACCOUNTS binding (./wrangler.toml). It answers the one
// binding-only door, the AI key door (liveworkspace/docs/specs/003-accounts/ai-keys.md "How an app's server gets the key"), answering that no
// team or personal key applies, so an asker with no knowledgebase key gets built-in AI as they would deployed with
// none set. It checks the api's client credentials as accounts does; the token it takes on trust (the stack's own).
// A product whose specs need a shared key would seed one here.

const json = (status, body) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    // Every other call over the binding already names the stack's accounts stand-in (its origin and /e2e/accounts
    // path, ../accounts-stand-in.mjs), as it would with no Worker behind the binding: it goes on there unchanged.
    if (url.pathname !== '/internal/ai-key') return fetch(request);
    if (request.method !== 'POST') return json(405, { error: 'method_not_allowed' });
    const expected = `Basic ${btoa(`${encodeURIComponent(env.CLIENT_ID)}:${encodeURIComponent(env.CLIENT_SECRET)}`)}`;
    if (request.headers.get('authorization') !== expected)
      return json(401, { error: 'invalid_client' });
    const body = await request.json().catch(() => null);
    if (!body || typeof body.token !== 'string' || !body.token)
      return json(400, { error: 'invalid_request' });
    return json(200, { source: null });
  },
};
