'use client';

// Write It Up (docs/specs/013-workspace/suggestions.md; liveworkspace/docs/specs/016-notifications/suggestions.md): a
// card this person moves to done with a decision in its description, or a Milestone reaching done, offers to write it
// up as a page in the team's knowledgebase in one click. The write path only notes the card (lib/write-up-trigger);
// the check reads it when the page is idle, and asks where the page would go once, after the words matched. An
// Editor's alone, signed in, with a knowledgebase they can edit.
import { useCallback, useEffect, useRef, useState } from 'react';
import { itemTitle, type Item } from '@liveplanner/items';
import { NextAppSuggestion } from '@liveworkspace/workbench/components/suggest/NextAppSuggestion';
import {
  writeUpFrom,
  writeUpTarget,
  writeUpToKnowledgebase,
} from '@liveworkspace/workbench/components/suggest/write-up';
import { useToast } from '@/hooks/ui/useToast';
import { cardLink } from '@/lib/card-address';
import { doneWriteUpCard, onStatusWrite, writeUpCardBody } from '@/lib/write-up-trigger';

const TITLE_SHOWN_MAX = 60;

const shown = (title: string) =>
  title.length > TITLE_SHOWN_MAX ? `${title.slice(0, TITLE_SHOWN_MAX - 1)}…` : title;

export function WriteUpSuggestion({
  itemId,
  allowed,
  planTitle,
  items,
  statusPhases,
  practiceIds,
  tabId,
}: {
  itemId: string | null;
  allowed: boolean;
  planTitle: string;
  items: ReadonlyMap<string, Item> | undefined;
  statusPhases: ReadonlyMap<string, string>;
  practiceIds?: ReadonlySet<string>;
  // The tab shown, the card's link opens it there.
  tabId: string;
}) {
  const toast = useToast();
  const latest = useRef({ items, statusPhases, practiceIds, tabId, planTitle, toast });
  useEffect(() => {
    latest.current = { items, statusPhases, practiceIds, tabId, planTitle, toast };
  }, [items, statusPhases, practiceIds, tabId, planTitle, toast]);
  // A status write asks for a check soon, rather than at the next tick.
  const [wake, setWake] = useState(0);
  useEffect(() => onStatusWrite(() => setWake((n) => n + 1)), []);

  const check = useCallback(() => {
    const now = latest.current;
    if (!itemId || !now.items) return null;
    const phases = now.statusPhases;
    const found = doneWriteUpCard(
      now.items,
      (status) => status !== undefined && phases.get(status) === 'done',
      now.practiceIds,
    );
    if (!found) return null;
    const title = itemTitle(found.item).trim() || 'Untitled card';
    const cardId = found.item.id;
    return writeUpTarget(itemId).then((kb) => {
      if (!kb) return null;
      const why = found.milestone ? 'is reached' : 'is done, with a decision in it';
      return {
        line: `“${shown(title)}” ${why}. Write it up in ${kb.title || 'your knowledgebase'} so the team can find it.`,
        run: () => {
          const { tabId: onTab, planTitle: from, toast: say } = latest.current;
          // The card's own address, never a share code.
          const link = cardLink({
            origin: window.location.origin,
            projectId: itemId,
            search: '',
            tabId: onTab,
            itemId: cardId,
          });
          const body = writeUpCardBody(found.item) || title;
          return writeUpToKnowledgebase(say, itemId, kb, {
            title,
            body: `${body}${writeUpFrom(from, 'liveplanner', link)}`,
          });
        },
      };
    });
  }, [itemId]);

  return (
    <NextAppSuggestion id="write-up" itemId={itemId} allowed={allowed} check={check} wake={wake} />
  );
}
