// The suites' fake host (docs/specs/015-api/blueprints/cli.md "Testing"): @liveworkspace/cli-kit's in-memory CliIo
// under this CLI's names, and the capabilities a host with sign-in at liveplanner.app answers.

import {
  fakeIo as kitFakeIo,
  hostCapabilities,
  type FakeIo,
  type FakeIoOptions,
} from '@liveworkspace/cli-kit/testing/fake-io';
import { PRODUCT } from '../product';

export {
  NOW,
  TOKEN,
  type FakeIo,
  type FakeSocket,
  type Route,
} from '@liveworkspace/cli-kit/testing/fake-io';

export const fakeIo = (options: FakeIoOptions = {}): FakeIo => kitFakeIo(PRODUCT, options);

// A host that has sign-in, at liveplanner.app.
export const capabilities = hostCapabilities({
  aiEnabled: false,
  apiBase: 'https://liveplanner.app/api',
  authEnabled: true,
  projectFormat: 2,
});
