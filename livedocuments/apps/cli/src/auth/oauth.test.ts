import { CLI_CLIENT_ID, DEVICE_CODE_GRANT } from '@livedocuments/api-schema';
import { describeOAuth } from '@liveworkspace/cli-kit/testing/suites/oauth';
import { run } from '../main';
import { PRODUCT } from '../product';
import { fakeIo } from '../testing/fake-io';
import { LOGIN_TIMEOUT_MS } from './oauth';

// `auth login` in the browser and by device code (docs/specs/015-api/cli.md "Authentication"): the suite every
// product CLI runs, over this CLI.
describeOAuth({
  product: PRODUCT,
  item: 'document',
  fakeIo,
  run,
  oauth: { LOGIN_TIMEOUT_MS, CLI_CLIENT_ID, DEVICE_CODE_GRANT },
});
