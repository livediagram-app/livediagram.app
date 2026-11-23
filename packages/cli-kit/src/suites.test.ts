import * as kitCapabilities from './capabilities';
import * as kitCredentials from './credentials';
import { debugLog } from './debug';
import { cacheDir, configDir } from './paths';
import * as kitProfiles from './profiles';
import { fakeIo as kitFakeIo, type FakeIoOptions } from './testing/fake-io';
import { describeConfig } from './testing/suites/config';
import { describeCredentials } from './testing/suites/credentials';
import { describeDebugLog } from './testing/suites/debug';
import { describeTransport } from './testing/suites/transport';
import { transport } from './transport';

// The suites every product's CLI runs over its bindings (testing/suites), run here over cli-kit itself for a
// product of its own, so the shared modules are tested where they live. The suites that need a whole CLI
// (keychain's sign-in, workbench pair and open, auth login) run in the products only.

const PRODUCT = {
  name: 'livetest',
  envPrefix: 'LIVETEST',
  npmPackage: '@livetest/cli',
  version: '1.2.3',
  clientId: 'livetest-cli',
};
const fakeIo = (options?: FakeIoOptions) => kitFakeIo(PRODUCT, options);
type Io = ReturnType<typeof fakeIo>;

describeConfig<Io>({
  product: PRODUCT,
  fakeIo,
  paths: {
    configDir: (io) => configDir(io, PRODUCT),
    cacheDir: (io) => cacheDir(io, PRODUCT),
  },
  profiles: {
    DEFAULT_HOST: kitProfiles.defaultHostOf(PRODUCT),
    readConfig: (io) => kitProfiles.readConfig(io, PRODUCT),
    resolveProfile: (flags, io, config) => kitProfiles.resolveProfile(flags, io, config, PRODUCT),
  },
  capabilitiesCache: {
    CAPABILITIES_CACHE_TTL_MS: kitCapabilities.CAPABILITIES_CACHE_TTL_MS,
    loadCapabilities: (io, profile, log) =>
      kitCapabilities.loadCapabilities(io, PRODUCT, 'documentFormat', profile, log),
  },
  version: { CLI_VERSION: PRODUCT.version, packageVersion: PRODUCT.version },
});

describeCredentials<Io>({
  product: PRODUCT,
  fakeIo,
  credentials: {
    storeCredential: (io, profile, details, token, log) =>
      kitCredentials.storeCredential(io, PRODUCT, profile, details, token, log),
    forgetCredential: (io, profile) => kitCredentials.forgetCredential(io, PRODUCT, profile),
    storedCredential: (io, profile) => kitCredentials.storedCredential(io, PRODUCT, profile),
    resolveCredential: (io, profile) => kitCredentials.resolveCredential(io, PRODUCT, profile),
  },
});

describeTransport<Io>({
  product: PRODUCT,
  item: 'document',
  fakeIo,
  transport: (io, apiBase, log) => transport(io, apiBase, log, PRODUCT),
});

describeDebugLog<Io>({
  product: PRODUCT,
  fakeIo,
  debugLog: (io, scope) => debugLog(io, PRODUCT, scope),
});
