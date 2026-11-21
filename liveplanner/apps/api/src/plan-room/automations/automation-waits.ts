// The runs a Wait holds (docs/specs/026-plan/automations.md "Wait"; blueprint automations.md "Wait"). Holding,
// stopping and waking them is @liveworkspace/automations/room's (liveworkspace/docs/specs/018-automations/blueprints/
// engine.md "The room entry"); here, the words a plan's Audit Trail says.
import { waitFullWords } from '@liveworkspace/automations/room';

export {
  WAIT_CONDITIONS,
  WAIT_RULE_CHANGED,
  holdRun,
  runWaits,
  stopWaits,
} from '@liveworkspace/automations/room';

export const WAIT_FULL = waitFullWords('plan');
