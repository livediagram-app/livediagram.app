import { describeDebugLog } from '@liveworkspace/cli-kit/testing/suites/debug';
import { debugLog } from './debug';
import { PRODUCT } from './product';
import { fakeIo } from './testing/fake-io';

describeDebugLog({ product: PRODUCT, fakeIo, debugLog });
