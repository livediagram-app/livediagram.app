import { DEVICE_SLOW_DOWN_S } from '@livedesign/api-schema';
import { describeWorkbenchPair } from '@liveworkspace/cli-kit/testing/suites/workbench-pair';
import { run } from '../main';
import { PRODUCT } from '../product';
import { capabilities, fakeIo } from '../testing/fake-io';

// `workbench pair` (docs/specs/013-workspace/blueprints/workbench-embeds.md "The CLI", WB24, WB25, WB45): the suite
// every product CLI runs, over this CLI.
describeWorkbenchPair({
  product: PRODUCT,
  item: 'design',
  fakeIo,
  capabilities,
  run,
  deviceSlowDownS: DEVICE_SLOW_DOWN_S,
});
