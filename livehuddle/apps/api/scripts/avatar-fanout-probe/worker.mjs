// The avatar fan-out probe's Worker (README.md beside this file): the real DocumentRoom, with a door that opens a
// socket on it as a verified Viewer, so the driver can walk any number of characters through one Durable Object on
// a local workerd. Local only, never deployed.
import { DocumentRoom } from '../../src/document-room/document-room';

export { DocumentRoom };

export default {
  /** @param {Request} request @param {{ DOCUMENT_ROOM: DurableObjectNamespace }} env */
  fetch(request, env) {
    const room = new URL(request.url).searchParams.get('room') ?? 'probe';
    const headers = new Headers(request.headers);
    headers.set('X-Verified-Role', 'view');
    const stub = env.DOCUMENT_ROOM.get(env.DOCUMENT_ROOM.idFromName(room));
    return stub.fetch(new Request(request, { headers }));
  },
};
