// What each verb of a row's menu does (docs/specs/030-knowledgebase/knowledgebases-and-pages.md "Row menu"; a connected
// row's, links-and-embeds.md "Connected files in the sidebar"): the tree's props in, the call made. The tree hands
// these its newest props when a verb runs, so the menus never hold stale ones.
import type { ConnectedMenuVerb } from './ConnectedRowMenu';
import type { PageTreeConnected } from './connected-rows';
import type { PageMenuVerb } from './PageTreeRowMenu';
import type { PageTreeActions, PageTreeKnowledge } from './PageTree';

export type PageVerbDeps = {
  actions: PageTreeActions;
  onSetOpen: (id: string, open: boolean) => void;
  knowledge?: PageTreeKnowledge | undefined;
  connected?: PageTreeConnected | undefined;
  // Rename opens the row's field, which is the tree's own state.
  rename: (id: string) => void;
};

export function runPageVerb(verb: PageMenuVerb, id: string, deps: PageVerbDeps): void {
  const { actions: act, onSetOpen: setOpen, knowledge: know, connected: link } = deps;
  switch (verb) {
    case 'connect-here':
      // The new row shows: its page opens.
      setOpen(id, true);
      return void link?.onConnect(id);
    case 'verify':
      return know?.onVerify(id);
    case 'approval':
      return know?.onRequestApproval?.(id);
    case 'reading':
      return know?.onRequireReading?.(id);
    case 'context':
      return know?.onSetContext(id, !know.inContext.has(id));
    case 'rename':
      return deps.rename(id);
    case 'add':
      // The new subpage shows: its parent opens.
      setOpen(id, true);
      return act.onAdd(id);
    case 'duplicate':
      return act.onDuplicate(id);
    case 'copy-link':
      return act.onCopyLink(id);
    case 'up':
      return act.onStep(id, -1);
    case 'down':
      return act.onStep(id, 1);
    case 'indent':
      return act.onIndent(id);
    case 'outdent':
      return act.onOutdent(id);
    case 'delete':
      return act.onDelete(id);
  }
}

export function runConnectedVerb(
  verb: ConnectedMenuVerb,
  id: string,
  { actions: act, connected: link }: Pick<PageVerbDeps, 'actions' | 'connected'>,
): void {
  switch (verb) {
    case 'open':
      return link?.onOpen(id);
    case 'copy-link':
      return link?.onCopyLink(id);
    case 'connect-again':
      return link?.onConnectAgain(id);
    case 'remove':
      return link?.onRemove(id);
    case 'up':
      return act.onStep(id, -1);
    case 'down':
      return act.onStep(id, 1);
    case 'indent':
      return act.onIndent(id);
    case 'outdent':
      return act.onOutdent(id);
  }
}
