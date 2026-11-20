// Who may do what to a page's knowledge (docs/specs/030-knowledgebase/verification.md "Share roles",
// links-and-embeds.md "Share roles"): Verify, the owner and Always in Context are an Editor's,
// on the whole knowledgebase (never a link confined to one page); everyone reads the states. Verify also says who
// vouches for the page, so it needs an account. Presentation only: the api is the rule.
import type { EditorCapabilities } from '@/lib/editor-capabilities';

export type KnowledgeRights = {
  /** Owner, Always in Context. */
  editFields: boolean;
  /** Verify and Verify Again. */
  verify: boolean;
};

export function knowledgeRights(input: {
  can: Pick<EditorCapabilities, 'editPages'>;
  isStructureReadOnly: boolean;
  accountUserId: string | null | undefined;
  // A knowledgebase kept in this browser has no room to write the fields.
  offline: boolean;
}): KnowledgeRights {
  const editor = input.can.editPages && !input.isStructureReadOnly && !input.offline;
  return { editFields: editor, verify: editor && !!input.accountUserId };
}
