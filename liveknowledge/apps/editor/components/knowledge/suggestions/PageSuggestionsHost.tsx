'use client';

// The open page's suggested edits in its writing and over it (docs/specs/030-knowledgebase/insights.md "On the
// page"; blueprint suggested-edits-ui.md): mounted once with the canvas chrome. It hands the page's suggestions to the
// writing (lib/article/article-suggestion-plugin.ts), draws a margin marker into each one the writing found, opens
// the popover (a sheet on a phone) and Show in Page's bar, reads the page's health again when the room says
// suggestions changed, and opens the suggestion an address names (`#t=<page>&suggestion=<id>`, the Inbox's Open).
import { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip, useEscape } from '@liveknowledge/ui';
import { useEditorChrome, useEditorChromeStore } from '@/app/document/[id]/EditorContext';
import { pageKnowledgeStore } from '@/lib/knowledge/page-knowledge-store';
import { suggestionsView } from '@/lib/knowledge/page-suggestions-view';
import { useRelativeNow } from '@/lib/relative-time';
import { track } from '@/lib/telemetry';
import { SuggestionCard } from './SuggestionCard';
import { SuggestionPopover } from './SuggestionPopover';
import { SuggestionReviewBar } from './SuggestionReviewBar';
import { SuggestionMarkIcon } from './suggestion-icons';
import { usePageSuggestions } from './usePageSuggestions';

const SUGGESTION_PARAM = 'suggestion';

/** The suggestion an address's hash names, if any. */
export function askedSuggestionOf(hash: string): string | null {
  const id = new URLSearchParams(hash.replace(/^#/, '')).get(SUGGESTION_PARAM);
  return id && /^[\w-]{1,64}$/.test(id) ? id : null;
}

// The hash without its suggestion, so a reload does not open it again.
function dropAsked(): void {
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  if (!params.has(SUGGESTION_PARAM)) return;
  params.delete(SUGGESTION_PARAM);
  const hash = params.toString();
  const { pathname, search } = window.location;
  window.history.replaceState(null, '', `${pathname}${search}${hash ? `#${hash}` : ''}`);
}

export function PageSuggestionsHost({ sheet }: { sheet: boolean }) {
  const chrome = useEditorChromeStore();
  const page = usePageSuggestions();
  const { suggestions, view, rights } = page;
  const tab = useEditorChrome((s) => s.pageTab.id);
  const flowKey = useEditorChrome((s) => Object.keys(s.pageTab.articles ?? {}).join('\n'));
  const verified = useEditorChrome((s) => s.activeTab.knowledge?.verifiedAt !== undefined);
  const now = useRelativeNow();

  // The marks the writing draws: only for the page whose health this is.
  const flows = useMemo(() => (flowKey ? flowKey.split('\n') : []), [flowKey]);
  useEffect(() => {
    suggestionsView.setMarks(tab, flows, page.pageId === tab ? suggestions : []);
  }, [tab, flows, suggestions, page.pageId]);
  useEffect(() => () => suggestionsView.setMarks(null, [], []), []);

  // The room said suggestions changed: this page's health once more (its counts too).
  useEffect(() => {
    if (view.pushed === 0) return;
    const editor = chrome.get();
    if (!editor.documentId || !rights.see) return;
    void pageKnowledgeStore.load(
      { ownerId: editor.selfParticipant.id, shareCode: editor.sessionShareCode },
      editor.documentId,
      editor.activeId,
      true,
    );
  }, [chrome, view.pushed, rights.see]);

  // An address naming a suggestion: held until the page's suggestions arrive, then opened, centred.
  useEffect(() => {
    const read = () => {
      const id = askedSuggestionOf(window.location.hash);
      if (id) suggestionsView.ask(id);
    };
    read();
    window.addEventListener('hashchange', read);
    return () => window.removeEventListener('hashchange', read);
  }, []);
  useEffect(() => {
    if (!view.asked) return;
    const asked = suggestions.find((s) => s.id === view.asked);
    if (!asked) return;
    suggestionsView.ask(null);
    dropAsked();
    track('UI', 'Opened', 'SuggestionFromLink');
    suggestionsView.open(asked.id, null);
  }, [view.asked, suggestions]);

  useEscape(
    () => {
      if (view.open) suggestionsView.close();
      else suggestionsView.show(null);
    },
    { enabled: view.open !== null || view.showing !== null },
  );

  const byId = new Map(suggestions.map((s) => [s.id, s]));
  const open = view.open ? byId.get(view.open.id) : undefined;
  const showing = view.showing ? byId.get(view.showing) : undefined;
  const openAt = open ? suggestions.indexOf(open) : -1;

  return (
    <>
      {suggestions.map((s) => {
        const host = view.found.get(s.id) ? suggestionsView.hosts().get(s.id) : undefined;
        if (!host || view.showing) return null;
        const label =
          s.kind === 'append'
            ? `${s.agent} suggested an addition here`
            : `${s.agent} suggested an edit here`;
        return createPortal(
          <Tooltip label={label}>
            <button
              type="button"
              aria-label={label}
              aria-haspopup="dialog"
              aria-expanded={view.open?.id === s.id}
              data-suggestion-marker-button={s.id}
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                if (view.open?.id === s.id) suggestionsView.close();
                else {
                  track('UI', 'Opened', 'SuggestionMarker');
                  suggestionsView.open(s.id, e.currentTarget);
                }
              }}
              className="absolute -left-11 top-0.5 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-violet-700 text-white ring-4 ring-violet-100 motion-safe:transition-transform motion-safe:duration-micro hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-700 phone:-left-9 dark:bg-violet-500 dark:ring-violet-500/25"
            >
              <SuggestionMarkIcon />
            </button>
          </Tooltip>,
          host,
          s.id,
        );
      })}
      {open ? (
        <SuggestionPopover
          anchor={view.open?.anchor ?? null}
          sheet={sheet}
          onClose={() => suggestionsView.close()}
        >
          <SuggestionCard
            suggestion={open}
            now={now}
            canDecide={rights.decide}
            missing={page.missing(open.id)}
            verified={verified}
            accepting={view.busy.has(`accept:${open.id}`)}
            dismissing={view.busy.has(`dismiss:${open.id}`)}
            position={{
              at: openAt,
              of: suggestions.length,
              onPrev: () => suggestionsView.open(suggestions[openAt - 1]!.id, null),
              onNext: () => suggestionsView.open(suggestions[openAt + 1]!.id, null),
            }}
            // It stays open, busy, until the suggestion is gone (the store closes it then).
            onAccept={() => page.accept(open)}
            onShow={() => {
              track('UI', 'Used', 'SuggestionShownInPage');
              suggestionsView.show(open.id);
            }}
            onDismiss={() => page.dismiss(open)}
            onClose={() => suggestionsView.close()}
          />
        </SuggestionPopover>
      ) : null}
      {showing ? (
        <SuggestionReviewBar
          suggestion={showing}
          canDecide={rights.decide}
          accepting={view.busy.has(`accept:${showing.id}`)}
          dismissing={view.busy.has(`dismiss:${showing.id}`)}
          onAccept={() => page.accept(showing)}
          onDismiss={() => page.dismiss(showing)}
          onDone={() => suggestionsView.show(null)}
        />
      ) : null}
    </>
  );
}
