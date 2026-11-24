import { describeCredentials } from '@liveworkspace/cli-kit/testing/suites/credentials';
import { PRODUCT } from '../product';
import { fakeIo } from '../testing/fake-io';
import * as credentials from './credentials';

// Credentials (docs/specs/015-api/cli.md "Authentication"): the suite every product CLI runs, over this CLI's.
describeCredentials({ product: PRODUCT, fakeIo, credentials });
