// The two checks, in the spec's code order.

import { labelOverflow } from './label-overflow';
import { textOverflow } from './text-overflow';
import type { Check } from './types';

export const LINT_CHECKS: readonly Check[] = [labelOverflow, textOverflow];
