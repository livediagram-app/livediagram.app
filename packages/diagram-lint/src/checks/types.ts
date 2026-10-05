// What a check returns before ordering: the finding without its severity, and where its primary
// subject sits for reading order (null reads first).

import type { LintCode } from '@livediagram/api-schema';
import type { Point } from '@livediagram/document';
import type { LintContext } from '../context';
import type { LintLogger } from '../log';
import type { Crossings } from '../measures';

export type RawFinding = {
  code: LintCode;
  refs: string[];
  message: string;
  fix: string;
  at: Point | null;
};

export type CheckInput = LintContext & { crossings: Crossings | null; log: LintLogger };

export type Check = (input: CheckInput) => RawFinding[];
