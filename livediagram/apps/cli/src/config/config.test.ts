import { readFileSync } from 'node:fs';
import { describeConfig } from '@liveworkspace/cli-kit/testing/suites/config';
import { PRODUCT } from '../product';
import { fakeIo } from '../testing/fake-io';
import * as capabilitiesCache from './capabilities';
import * as paths from './paths';
import * as profiles from './profiles';
import { CLI_VERSION } from './version';

// Paths, config.toml, profiles, the capabilities cache and the version: the suite every product CLI runs, over
// this CLI's modules and its package.json.
const pkg = JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as {
  version: string;
};
describeConfig({
  product: PRODUCT,
  fakeIo,
  paths,
  profiles,
  capabilitiesCache,
  version: { CLI_VERSION, packageVersion: pkg.version },
});
