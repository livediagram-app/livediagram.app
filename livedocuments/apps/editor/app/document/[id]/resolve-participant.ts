// Who is opening the editor (@liveworkspace/workbench/lib/resolve-participant), bound to this editor's self calls,
// guest identity and placeholder names.
import { createResolveParticipant } from '@liveworkspace/workbench/lib/resolve-participant';
import { apiLoadSelf, apiSaveSelf } from '@/lib/api-client';
import { ensureGuestIdentity } from '@/lib/guest-identity';
import { randomColor, randomName, type Participant } from '@/lib/identity';

export { firstVisitName } from '@liveworkspace/workbench/lib/resolve-participant';

export const resolveParticipant = createResolveParticipant<Participant>({
  apiLoadSelf,
  apiSaveSelf,
  ensureGuestIdentity,
  randomName,
  randomColor,
});
