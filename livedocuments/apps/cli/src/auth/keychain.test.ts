import { describeKeychain } from '@liveworkspace/cli-kit/testing/suites/keychain';
import { PRODUCT } from '../product';
import { fakeIo } from '../testing/fake-io';
import * as credentials from './credentials';

// The token in the platform's own store (docs/specs/015-api/cli.md "Authentication", blueprint CLI4, E13): the
// suite every product CLI runs, over this CLI's credentials.
describeKeychain({
  product: PRODUCT,
  fakeIo,
  credentials,
  // The whole CLI, loaded only by the one test that signs in again.
  run: async (argv, io) => (await import('../main')).run(argv, io),
});
