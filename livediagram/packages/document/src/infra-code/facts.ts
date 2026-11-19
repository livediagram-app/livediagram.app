// What the Infrastructure panel shows of a file before it is drawn (blueprint "infraFileFacts"): its format, for the
// row's badge, and the Wrangler environments it names, for the environment choice. Never an error: a file that does
// not read has no environments, and its error comes when the import runs.

import { detectInfraFormat } from './detect';
import { envsOf, readInfraFile } from './file-part';
import type { InfraFile, InfraFormat } from './types';

export function infraFileFacts(file: InfraFile): { format: InfraFormat; envs: string[] } {
  const format = detectInfraFormat(file.name, file.text);
  if (format !== 'wrangler') return { format, envs: [] };
  const read = readInfraFile(file);
  return { format, envs: read.ok ? envsOf(read.parsed) : [] };
}
