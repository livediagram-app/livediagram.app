import { describeWorkbenchOpen } from '@liveworkspace/cli-kit/testing/suites/workbench-open';
import { run } from '../main';
import { PRODUCT } from '../product';
import { capabilities, fakeIo } from '../testing/fake-io';

// `workbench open` (docs/specs/013-workspace/blueprints/workbench-embeds.md "The CLI"): the suite every product CLI
// runs, over this CLI.
describeWorkbenchOpen({ product: PRODUCT, item: 'project', fakeIo, capabilities, run });
