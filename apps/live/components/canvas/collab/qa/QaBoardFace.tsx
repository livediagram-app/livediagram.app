// The face of a Q&A board (docs/specs/012-collaboration/qa-board.md): the spotlight over the live queue over
// the Discussed drawer, with the composer at the foot.
//
// Built as a queue the room WATCHES rather than a form it fills in: rows slide
// as the ranking moves (useFlipList), a vote pops and lifts a +1, the top note
// wears "Most wanted" and every row carries a heat bar against it, and the
// note being discussed lifts into a lit card with a breathing live dot.

import { useEffect, useState } from 'react';
import { qaView, qaVoterId, type QaNote, type ShapeElement } from '@livediagram/diagram';
import { CollabPanel } from '../collab-chrome';
import {
  ElementEllipsisMenu,
  ElementMenuItem,
  ElementMenuSettingsRow,
} from '@/components/canvas/ElementEllipsisMenu';
import { QaNoteRow } from './QaNoteRow';
import { QaSpotlight } from './QaSpotlight';
import { QaDiscussed } from './QaDiscussed';
import { QaComposer } from './QaComposer';
import { AccentBar, DiscussGlyph, EmptyRows } from './qa-parts';
import { CollabAccentScope } from '../collab-accent';
import { useFlipList } from './useFlipList';

// What the board can do for this viewer. Participant verbs are present for
// anyone in a live session (view links too); the facilitator verbs only for
// whoever is running the board (docs/specs/012-collaboration/facilitator.md). Everything absent = inert.
export type QaFaceActions = {
  add?: (text: string, anonymous: boolean) => void;
  vote?: (noteId: string, on: boolean) => void;
  discuss?: (noteId: string | null) => void;
  close?: (noteId: string) => void;
  reopen?: (noteId: string) => void;
  remove?: (noteId: string) => void;
  clear?: () => void;
};

// Our voter id on this board, computed the way the server computes it
// (qaVoterId), so the face knows which notes we voted for.
function useSelfVoterId(ownerId: string, elementId: string): string {
  const [id, setId] = useState('');
  useEffect(() => {
    if (!ownerId) return;
    let live = true;
    void qaVoterId(ownerId, elementId).then((v) => live && setId(v));
    return () => {
      live = false;
    };
  }, [ownerId, elementId]);
  return id;
}

export function QaBoardFace({
  element,
  label,
  textColor,
  surface,
  selfOwnerId,
  selfName,
  actions,
  onOpenSettings,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  surface: string;
  // Ours, for the voter id; never rendered or sent anywhere from here.
  selfOwnerId: string;
  selfName: string;
  actions: QaFaceActions;
  onOpenSettings?: () => void;
}) {
  const notes: QaNote[] = element.qaNotes ?? [];
  const { discussing, queue, done } = qaView(notes);
  const voterId = useSelfVoterId(selfOwnerId, element.id);
  const rowRef = useFlipList(queue.map((n) => n.id));
  // Notes posted after the board appeared settle in; the ones already there
  // when it first paints don't all animate at once.
  const [initialIds] = useState(() => new Set(notes.map((n) => n.id)));

  const maxVotes = queue.reduce((m, n) => Math.max(m, n.voters.length), 0);
  const mine = (n: QaNote) => voterId !== '' && n.voters.includes(voterId);
  const vote = actions.vote;
  const running = !!actions.discuss;
  const total = notes.length;

  const menu =
    actions.clear || onOpenSettings ? (
      <ElementEllipsisMenu label="Q&A board options" color={textColor} align="left">
        {(close) => (
          <>
            {discussing && actions.discuss ? (
              <ElementMenuItem
                onPress={() => {
                  actions.discuss!(null);
                  close();
                }}
              >
                Clear the spotlight
              </ElementMenuItem>
            ) : null}
            {actions.clear ? (
              <ElementMenuItem
                onPress={() => {
                  actions.clear!();
                  close();
                }}
              >
                {total ? `Empty the board (${total})` : 'Empty the board'}
              </ElementMenuItem>
            ) : null}
            {onOpenSettings ? (
              <ElementMenuSettingsRow
                onOpen={() => {
                  onOpenSettings();
                  close();
                }}
              />
            ) : null}
          </>
        )}
      </ElementEllipsisMenu>
    ) : undefined;

  return (
    // The accent is the TAB THEME's, shared with the Idea box (collab-accent.tsx).
    <CollabAccentScope element={element} textColor={textColor} surface={surface}>
      <CollabPanel
        element={element}
        // Resizing makes room for more notes rather than bigger ones.
        reflow
        title={label.trim() || 'Questions'}
        textColor={textColor}
        aside={total ? `${total} ${total === 1 ? 'note' : 'notes'}` : undefined}
        headerExtra={menu}
        footer={
          actions.add ? (
            <QaComposer textColor={textColor} selfName={selfName} onAdd={actions.add} />
          ) : undefined
        }
      >
        {discussing ? (
          <QaSpotlight
            note={discussing}
            mine={mine(discussing)}
            textColor={textColor}
            onVote={vote ? () => vote(discussing.id, !mine(discussing)) : undefined}
            onDone={actions.close ? () => actions.close!(discussing.id) : undefined}
            hasNext={queue.length > 0}
            onDoneNext={
              actions.close && actions.discuss
                ? () => {
                    const next = queue[0];
                    actions.close!(discussing.id);
                    if (next) actions.discuss!(next.id);
                  }
                : undefined
            }
            onReturn={actions.discuss ? () => actions.discuss!(null) : undefined}
          />
        ) : running && queue.length > 0 ? (
          <AccentBar onPress={() => actions.discuss!(queue[0]!.id)} icon={<DiscussGlyph />}>
            Discuss the top note
          </AccentBar>
        ) : null}

        {queue.length === 0 && !discussing && done.length === 0 ? (
          <EmptyRows textColor={textColor} title="No notes yet">
            {actions.add
              ? 'Be the first to add one. Upvote the notes you want to talk about and they rise to the top.'
              : undefined}
          </EmptyRows>
        ) : (
          <ul className="relative flex flex-col gap-1.5">
            {queue.map((note, i) => (
              <QaNoteRow
                key={note.id}
                ref={rowRef(note.id)}
                note={note}
                rank={i}
                maxVotes={maxVotes}
                mine={mine(note)}
                fresh={!initialIds.has(note.id)}
                textColor={textColor}
                onVote={vote ? () => vote(note.id, !mine(note)) : undefined}
                actions={
                  running
                    ? {
                        onDiscuss: () => actions.discuss!(note.id),
                        onDone: () => actions.close?.(note.id),
                        onRemove: () => actions.remove?.(note.id),
                      }
                    : undefined
                }
              />
            ))}
            {queue.length === 0 && discussing ? (
              <li className="px-1 py-1 text-[11px] opacity-50" style={{ color: textColor }}>
                Nothing else queued. New notes land here.
              </li>
            ) : null}
          </ul>
        )}

        <QaDiscussed notes={done} textColor={textColor} onReopen={actions.reopen} />
      </CollabPanel>
    </CollabAccentScope>
  );
}
