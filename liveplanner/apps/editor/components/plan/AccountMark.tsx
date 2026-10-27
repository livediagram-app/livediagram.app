'use client';

// The liveworkspace account mark (docs/specs/026-plan/items.md "Custom assignees", "Accounts are marked"): a small
// liveworkspace prism left of a person's name in the Assignee picker's open list, and only there, saying they are a
// real liveworkspace identity rather than a custom assignee, who gets nothing. One inline SVG (the stateless glyph),
// so a long list pays for a few paths a row and no image requests. No visible tooltip (the owner's call): the
// label is for screen readers only, on the mark and in its row's name.
import { BrandGlyph } from '@liveplanner/ui';
import { isIdentityPersonId } from '@liveplanner/items';

export const ACCOUNT_MARK_LABEL = 'liveworkspace account';

export function AccountMark() {
  return (
    <span
      role="img"
      aria-label={ACCOUNT_MARK_LABEL}
      data-account-mark=""
      className="inline-flex size-3 shrink-0 text-slate-500 dark:text-slate-400"
    >
      <BrandGlyph className="size-full" />
    </span>
  );
}

// Whether a person carries the mark: a liveworkspace identity (a hashed person id), never a custom assignee (`n-`)
// or a template's example person (`example-`).
export const hasAccountMark = (person: { id: string }): boolean => isIdentityPersonId(person.id);
