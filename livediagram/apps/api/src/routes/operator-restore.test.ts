// The operator's restore door on this api (liveworkspace/docs/specs/002-architecture/room-restore.md,
// docs/specs/015-api/api.md "Operator restore"), through the Worker as deployed: the shared suite's key and role
// checks, and each of this api's classes reached by name.
import { describeRestoreDoor } from '@liveworkspace/api-kit/testing/restore-door';
import worker from '../index';

describeRestoreDoor({
  fetch: (request, env) => worker.fetch(request, env),
  classes: { DocumentRoom: 'DOCUMENT_ROOM', PersonStore: 'PERSON_STORE' },
  otherKeyName: 'INDEX_KEY',
});
