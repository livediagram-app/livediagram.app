// The suites' fake host (docs/specs/015-api/blueprints/cli.md "Testing"): @liveworkspace/cli-kit's in-memory CliIo
// under this CLI's names, and the capabilities a host with sign-in at livedocuments.app answers.

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

// A host that has sign-in, at livedocuments.app.
export const capabilities = hostCapabilities({
  apiBase: 'https://livedocuments.app/api',
  authEnabled: true,
  documentFormat: 2,
});
