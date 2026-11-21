'use client';

// The plan's board addresses as an Email Received rule's Board picker marks them (docs/specs/026-plan/automations.md
// "Email Received"): read from the api (`GET /api/projects/:id/email-intake`) the first time the panel opens, once
// per builder, and again when the Email to Board dialog its Turn On Email to Board opened closes. Only an Editor of the
// whole plan may read them: for anyone else, a server that takes no mail or a failed read, nothing is marked. The
// builder provides it; EmailTriggerFields reads it.

import dynamic from 'next/dynamic';
import { createContext, use, useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { readEmailIntakes } from '../email-intake/email-intake-client';
import type { AutomationsScope } from './automations-client';
import type { EmailIntakeScope } from '../email-intake/email-intake-gate';

// The dialog's code loads the first time Turn On Email to Board is pressed.
const EmailIntakeDialog = dynamic(
  () => import('../email-intake/EmailIntakeDialog').then((m) => m.EmailIntakeDialog),
  { ssr: false },
);

// `none`: no owner id to ask with (a builder outside the editor), so nothing is read.
export type EmailAddressesStatus = 'idle' | 'loading' | 'ready' | 'error' | 'none';

export type EmailAddresses = {
  status: EmailAddressesStatus;
  // Whether this server takes mail at all.
  available: boolean;
  // The boards the api lists (a board just drawn may not be saved yet), and those with an address turned on.
  known: ReadonlySet<string>;
  addressed: ReadonlySet<string>;
  // Reads the addresses the first time it is asked (the panel opening); later calls do nothing.
  load: () => void;
  // Opens Email to Board on these boards; the addresses are read again when it closes.
  turnOn: (boardIds: readonly string[]) => void;
};

const NO_BOARDS: ReadonlySet<string> = new Set();

const EmailAddressesContext = createContext<EmailAddresses | null>(null);

export function useEmailAddresses(): EmailAddresses | null {
  return use(EmailAddressesContext);
}

type Scope = Pick<AutomationsScope, 'itemId' | 'shareCode'> & { ownerId?: string | undefined };

/** The addresses' state for one builder, its reads, and the boards Email to Board is open on (null: closed). */
export function useEmailAddressesState(scope: Scope): {
  value: EmailAddresses;
  dialog: { scope: EmailIntakeScope; boardIds: readonly string[]; onClose: () => void } | null;
} {
  const { ownerId, itemId, shareCode } = scope;
  const [status, setStatus] = useState<EmailAddressesStatus>(ownerId ? 'idle' : 'none');
  const [available, setAvailable] = useState(false);
  const [known, setKnown] = useState<ReadonlySet<string>>(NO_BOARDS);
  const [addressed, setAddressed] = useState<ReadonlySet<string>>(NO_BOARDS);
  const [openOn, setOpenOn] = useState<readonly string[] | null>(null);
  const asked = useRef(false);
  const full = useMemo<EmailIntakeScope | null>(
    // Email to Board's routes name the plan as their project.
    () => (ownerId ? { ownerId, projectId: itemId, shareCode } : null),
    [ownerId, itemId, shareCode],
  );

  const read = useCallback(() => {
    if (!full) return;
    setStatus('loading');
    readEmailIntakes(full).then(
      (got) => {
        setAvailable(got.available);
        setKnown(new Set(got.boards.map((b) => b.id)));
        setAddressed(new Set(got.intakes.map((i) => i.boardId)));
        setStatus('ready');
      },
      (error: unknown) => {
        debugLog('[automations] email-intakes.failed', { error: String(error) });
        setStatus('error');
      },
    );
  }, [full]);

  const load = useCallback(() => {
    if (asked.current) return;
    asked.current = true;
    read();
  }, [read]);

  const turnOn = useCallback((boardIds: readonly string[]) => setOpenOn(boardIds), []);

  const value = useMemo(
    () => ({ status, available, known, addressed, load, turnOn }),
    [status, available, known, addressed, load, turnOn],
  );
  const dialog =
    full && openOn
      ? {
          scope: full,
          boardIds: openOn,
          onClose: () => {
            setOpenOn(null);
            read();
          },
        }
      : null;
  return { value, dialog };
}

export function EmailAddressesProvider({
  state,
  children,
}: {
  state: ReturnType<typeof useEmailAddressesState>;
  children: ReactNode;
}) {
  const { value, dialog } = state;
  return (
    <EmailAddressesContext.Provider value={value}>
      {children}
      {dialog ? (
        <EmailIntakeDialog
          scope={dialog.scope}
          boardIds={dialog.boardIds}
          onClose={dialog.onClose}
        />
      ) : null}
    </EmailAddressesContext.Provider>
  );
}
