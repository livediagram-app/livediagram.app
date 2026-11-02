// A failure the CLI reports (docs/specs/015-api/cli.md "Output"): @liveworkspace/cli-kit's, printed with this
// product's engine refusals read as the commands that do the same (tool-names.ts).

import { formatError as formatIn, type CliFailure } from '@liveworkspace/cli-kit/cli-error';
import { inCliWords } from './tool-names';

export { CliError, type CliFailure } from '@liveworkspace/cli-kit/cli-error';

export const formatError = (given: CliFailure, json: boolean): string =>
  formatIn(given, json, inCliWords);
