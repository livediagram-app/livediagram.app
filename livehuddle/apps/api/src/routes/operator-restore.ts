// POST /api/internal/restore: the operator's restore door (liveworkspace/docs/specs/002-architecture/room-restore.md,
// docs/specs/015-api/api.md "Operator restore"), answered by @liveworkspace/api-kit/room-restore with OPERATOR_KEY.
// It reaches `DocumentRoom` and `PersonStore` by name, as the rest of this api does, and each restores itself through its own
// point-in-time recovery (restorePrepare, restoreNow).
import { handleRoomRestore } from '@liveworkspace/api-kit/room-restore';
import type { Env } from '../types';

export function handleOperatorRestore(request: Request, env: Env): Promise<Response> {
  return handleRoomRestore(request, {
    key: env.OPERATOR_KEY,
    app: 'livehuddle',
    rooms: {
      DocumentRoom: (name) => env.DOCUMENT_ROOM.get(env.DOCUMENT_ROOM.idFromName(name)),
      PersonStore: (name) => env.PERSON_STORE.get(env.PERSON_STORE.idFromName(name)),
    },
  });
}
