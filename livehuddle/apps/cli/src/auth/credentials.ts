// Credentials (docs/specs/015-api/cli.md "Authentication"): LIVEDIAGRAM_TOKEN first, else the profile's stored token,
// in the platform's keychain where there is one. @liveworkspace/cli-kit's, for livediagram.

import type { CliIo } from '../io';
import type { DebugLog } from '../debug';
import * as kit from '@liveworkspace/cli-kit/credentials';
import { PRODUCT } from '../product';

export type {
  CredentialDetails,
  CredentialSource,
  StoredCredential,
} from '@liveworkspace/cli-kit/credentials';

export const storeCredential = (
  io: CliIo,
  profile: string,
  details: kit.CredentialDetails,
  token: string,
  log: DebugLog,
): Promise<void> => kit.storeCredential(io, PRODUCT, profile, details, token, log);

export const forgetCredential = (io: CliIo, profile: string): Promise<void> =>
  kit.forgetCredential(io, PRODUCT, profile);

// What this profile stored, ignoring LIVEDIAGRAM_TOKEN.
export const storedCredential = (io: CliIo, profile: string) =>
  kit.storedCredential(io, PRODUCT, profile);

export const tokenOf = (io: CliIo, profile: string, stored: kit.StoredCredential) =>
  kit.tokenOf(io, PRODUCT, profile, stored);

export const resolveCredential = (io: CliIo, profile: string) =>
  kit.resolveCredential(io, PRODUCT, profile);
