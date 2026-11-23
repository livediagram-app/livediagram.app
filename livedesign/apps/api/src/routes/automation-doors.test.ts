import { describeAutomationDoors } from '@liveworkspace/api-kit/testing/product-api-suites';
import worker from '../index';

// The two doors no identity opens (docs/specs/013-workspace/automations.md; blueprint automations.md "Routes"): the
// suite every product's api runs.
describeAutomationDoors({ worker, roomBinding: 'DESIGN_ROOM' });
