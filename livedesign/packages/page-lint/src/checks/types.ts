// What a check returns before ordering: the finding without its severity, and where its primary
// subject sits for reading order (null reads first).

import type { LintCode } from '@livedesign/api-schema';
import type { Point } from '@livedesign/design';
import type { LintContext } from '../context';

export type RawFinding = {
  code: LintCode;
  refs: string[];
  message: string;
  fix: string;
  at: Point | null;
};

export type Check = (ctx: LintContext) => RawFinding[];
