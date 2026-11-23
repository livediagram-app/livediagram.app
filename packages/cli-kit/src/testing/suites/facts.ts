// What a product CLI hands the suites every CLI runs (this folder): its own bindings of @liveworkspace/cli-kit, by
// the names its modules export them under. Each suite takes only the ones it reads, so a product's test file
// imports no more than the module under test.

import type { CliFailure } from '../../cli-error';
import type { ConfigFile } from '../../config-file';
import type * as kitCredentials from '../../credentials';
import type { DebugLog } from '../../debug';
import type { CliProduct } from '../../product';
import type { Transport } from '../../transport';
import type { FakeIo, FakeIoOptions, Route } from '../fake-io';

export type SuiteProfile = {
  name: string;
  host: string;
  source: 'flag' | 'env' | 'config' | 'default';
};

export type CliSuiteFacts<Io extends FakeIo> = {
  /** The CLI as cli-kit names it (`PRODUCT`). */
  product: Pick<CliProduct, 'name' | 'envPrefix'>;
  /** What the product's items are called in its commands and api: `document`, `project`, `design`. */
  item: string;
  /** The product's fake host (`testing/fake-io`). */
  fakeIo: (options?: FakeIoOptions) => Io;
  /** A host that has sign-in (`capabilities` in `testing/fake-io`). */
  capabilities: Route;
  /** `run` in `main`; a suite that only sometimes needs the whole CLI is handed a lazy import. */
  run: (argv: readonly string[], io: Io) => Promise<number>;
  /** `auth/credentials`. */
  credentials: {
    storeCredential: (
      io: Io,
      profile: string,
      details: kitCredentials.CredentialDetails,
      token: string,
      log: DebugLog,
    ) => Promise<void>;
    forgetCredential: (io: Io, profile: string) => Promise<void>;
    storedCredential: (
      io: Io,
      profile: string,
    ) => ReturnType<typeof kitCredentials.storedCredential>;
    resolveCredential: (
      io: Io,
      profile: string,
    ) => ReturnType<typeof kitCredentials.resolveCredential>;
  };
  /** `config/paths`. */
  paths: { configDir: (io: Io) => string; cacheDir: (io: Io) => string };
  /** `config/profiles`. */
  profiles: {
    DEFAULT_HOST: string;
    readConfig: (io: Io) => Promise<ConfigFile>;
    resolveProfile: (
      flags: { host?: string; profile?: string },
      io: Io,
      config: ConfigFile,
    ) => SuiteProfile;
  };
  /** `config/capabilities`. */
  capabilitiesCache: {
    CAPABILITIES_CACHE_TTL_MS: number;
    loadCapabilities: (io: Io, profile: SuiteProfile, log: DebugLog) => Promise<unknown>;
  };
  /** `config/version`'s CLI_VERSION and the package.json's. */
  version: { CLI_VERSION: string; packageVersion: string };
  /** `transport`. */
  transport: (io: Io, apiBase: string, log: DebugLog) => Transport;
  /** `debug`. */
  debugLog: (io: Io, scope?: string) => DebugLog;
  /** `LOGIN_TIMEOUT_MS` in `auth/oauth`, and the product's OAuth client and device grant (its api-schema). */
  oauth: { LOGIN_TIMEOUT_MS: number; CLI_CLIENT_ID: string; DEVICE_CODE_GRANT: string };
  /** `DEVICE_SLOW_DOWN_S` in the product's api-schema. */
  deviceSlowDownS: number;
};

export type { CliFailure };
