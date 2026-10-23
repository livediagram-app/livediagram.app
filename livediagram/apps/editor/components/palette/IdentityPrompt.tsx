'use client';

import { useEffect, useRef, useState } from 'react';
import { Button, CloseIcon, useEscape } from '@livediagram/ui';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import { useModalGuard } from '@/hooks/ui/useModalGuard';
import type { Participant } from '@/lib/identity';
import { CanvasModalCard } from './CanvasModalCard';
import { IdentityNameRow } from './IdentityNameRow';
import { SparkleIcon } from './template-picker-icons';

// The visitor name prompt (docs/specs/007-editor/new-document-route.md): someone joining another person's document
// confirms the name others will see on their cursor and comments before they join. Join keeps the name typed, Cancel,
// the X and Escape the one they had. A signed-in visitor's name is their account's, shown locked.
export function IdentityPrompt({
  participant,
  documentName,
  lockedName,
  onJoin,
  onCancel,
}: {
  participant: Participant;
  // Greets the visitor by the document ("Welcome to 'API sketch'").
  documentName?: string;
  // The account's name: the input reads it, locked.
  lockedName?: string | null;
  onJoin: (name: string) => void;
  onCancel: () => void;
}) {
  // Over the canvas: silence its shortcut and paste listeners behind it (lib/modal-guard).
  useModalGuard(true);
  const nameLocked = !!lockedName;
  const [name, setName] = useState(lockedName ?? participant.name);
  // The participant resolves after mount (a 'Guest' placeholder first): the field follows it until the visitor types.
  const nameEdited = useRef(false);
  useEffect(() => {
    if (nameLocked || nameEdited.current) return;
    setName(participant.name);
  }, [participant.name, nameLocked]);
  useEscape(onCancel);
  const effectiveName = name.trim() || participant.name;
  const title = documentName?.trim()
    ? `Welcome to '${documentName.trim()}'`
    : 'Welcome to this document';
  return (
    <CanvasModalCard label="Confirm your name" width="sm:w-[26rem]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-6 pb-5 pt-6 dark:border-slate-800">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            {title}
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-300">
            {nameLocked
              ? 'This is the name from your account; others will see it on this document.'
              : 'Pick the name people will see while you collaborate on this document.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Close"
          className="-mr-2 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
        <IdentityNameRow
          participant={participant}
          name={name}
          effectiveName={effectiveName}
          nameLocked={nameLocked}
          onChangeName={(next) => {
            nameEdited.current = true;
            setName(next);
          }}
        />
      </div>
      <DialogFooter>
        <p className="mr-auto text-[11px] text-slate-500 dark:text-slate-400">
          Other participants will see this name on your cursor and comments.
        </p>
        <Button variant="secondary" size="xs" onClick={onCancel}>
          Cancel
        </Button>
        <Button size="xs" onClick={() => onJoin(effectiveName)} className="gap-1.5 px-4 shadow-sm">
          <SparkleIcon />
          Join
        </Button>
      </DialogFooter>
    </CanvasModalCard>
  );
}
