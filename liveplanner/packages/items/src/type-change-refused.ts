// A refused card type change (docs/specs/026-plan/plan-agents.md "Changing card types"): thrown while a change is
// applied, caught once by applyCardTypeChanges, which saves nothing and answers the refusal.
import type { NameRefusal } from './plan-names';

export type TypeChangeRefusal =
  NameRefusal | { code: 'type_change_invalid' | 'display_invalid'; message: string };

export class Refused extends Error {
  readonly refusal: TypeChangeRefusal;
  constructor(refusal: TypeChangeRefusal) {
    super(refusal.message);
    this.refusal = refusal;
  }
}

export const invalid = (message: string) => new Refused({ code: 'type_change_invalid', message });
