// The avatar fan-out probe's Worker (README.md beside this file): the real DocumentRoom, with a door that opens a
// socket on it as a verified Viewer, so the driver can walk any number of characters through one Durable Object on
// a local workerd. `&role=participate` opens it as a Participant instead, for the talking probe. Local only, never
// deployed.
import { DocumentRoom } from '../../src/document-room/document-room';

export { DocumentRoom };

export default {
  /** @param {Request} request @param {{ DOCUMENT_ROOM: DurableObjectNamespace }} env */
  fetch(request, env) {
    const params = new URL(request.url).searchParams;
    const room = params.get('room') ?? 'probe';
    const headers = new Headers(request.headers);
    // A talker is a Participant: the room drops a Viewer's talking level (proximity-audio.md "Share roles").
    headers.set('X-Verified-Role', params.get('role') === 'participate' ? 'participate' : 'view');
    const stub = env.DOCUMENT_ROOM.get(env.DOCUMENT_ROOM.idFromName(room));
    return stub.fetch(new Request(request, { headers }));
  },
};
