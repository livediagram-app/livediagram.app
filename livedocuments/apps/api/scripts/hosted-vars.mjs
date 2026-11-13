// The hosted profile (docs/specs/016-platform/deployment.md "Hosted profile"): the plain vars
// livedocuments.app's own deploys add on top of wrangler.toml, and a fork's do not, in ../hosted-vars.json.
// The commands and the checks are @liveworkspace/api-kit/hosted-vars; run from apps/api:
//
//   node scripts/hosted-vars.mjs flags | build-env | verify [--env staging]

import { fileURLToPath } from 'node:url';
import {
  readHostedProfile as readProfile,
  runHostedVars,
} from '@liveworkspace/api-kit/hosted-vars';

export const HOSTED_VARS_PATH = fileURLToPath(new URL('../hosted-vars.json', import.meta.url));

/** This api's profile, read and checked. */
export const readHostedProfile = (path = HOSTED_VARS_PATH) => readProfile(path);

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exitCode = runHostedVars(process.argv.slice(2), HOSTED_VARS_PATH);
}
