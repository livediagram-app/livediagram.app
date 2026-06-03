// Share-link actions for the Share dialog, lifted out of
// editor-page.tsx: create / revoke a link, build the absolute visitor
// URL, and save the participant's display name (the dialog's identity
// card). The share-link list + shareable flags stay as page state
// because the hydration / save effects also write them; this hook owns
// only the mutations the dialog triggers and reconciles that state
// through the setters passed in.

import type { Dispatch, SetStateAction } from 'react';
import {
  apiCreateShareLink,
  apiDeleteShareLink,
  apiSaveSelf,
  apiSetSharePassword,
  type ShareLink,
  type ShareRole,
} from '@/lib/api-client';
import { track } from '@/lib/telemetry';
import type { Participant } from '@/lib/identity';

type ShareLinksDeps = {
  // The current diagram id. All link actions no-op until it exists
  // (the editor route always has a real id by the time the dialog is
  // open — the mint-id flow lives on /live/new, spec/14).
  diagramId: string | null;
  selfParticipant: Participant;
  setSelfParticipant: Dispatch<SetStateAction<Participant>>;
  setShareLinks: Dispatch<SetStateAction<ShareLink[]>>;
  // The diagram's share password (spec/24). setSharePassword reconciles
  // page state after a save / clear.
  setSharePassword: Dispatch<SetStateAction<string | null>>;
  setDiagramShareable: Dispatch<SetStateAction<boolean>>;
  setDiagramShareCode: Dispatch<SetStateAction<string | null>>;
  // The diagram's primary share code; revoke promotes the next link to
  // primary when the current primary is the one being revoked.
  diagramShareCode: string | null;
  // Marks the participant's name confirmed (share is an implicit
  // confirmation gesture).
  confirmName: () => void;
};

export function useShareLinks(deps: ShareLinksDeps) {
  const {
    diagramId,
    selfParticipant,
    setSelfParticipant,
    setShareLinks,
    setSharePassword,
    setDiagramShareable,
    setDiagramShareCode,
    diagramShareCode,
    confirmName,
  } = deps;

  // Save the participant's name (used from the share dialog's identity
  // card). Mints the diagram id if this is the first share gesture so
  // the share URL is shareable from the moment it's created.
  const updateParticipantName = async (name: string) => {
    if (!name) return;
    if (name === selfParticipant.name) return;
    const updated: Participant = { ...selfParticipant, name };
    setSelfParticipant(updated);
    await apiSaveSelf(updated).catch(() => {});
  };

  // Create a new share link for the current diagram with the given
  // role. The editor route always has a real diagramId by the time
  // the Share dialog is open — the welcome / mint-id flow now lives
  // on /live/new (spec/14) — so this just calls the API directly.
  const createShareLink = async (role: ShareRole) => {
    if (!diagramId) return;
    confirmName();
    try {
      const link = await apiCreateShareLink(selfParticipant.id, diagramId, role);
      setShareLinks((prev) => [...prev, link]);
      setDiagramShareable(true);
      setDiagramShareCode((prev) => prev ?? link.code);
      // Telemetry (spec/22): a share link was created. `type` is the
      // role (Edit / View) — a preset, never user content.
      track('Diagram', 'Shared', role === 'edit' ? 'Edit' : 'View');
    } catch {
      // Network glitch — leave state alone. A real app would toast.
    }
  };

  const revokeShareLink = async (code: string) => {
    if (!diagramId) return;
    try {
      await apiDeleteShareLink(selfParticipant.id, diagramId, code);
    } catch {
      // ignore — list refresh below reconciles if it actually went through.
    }
    setShareLinks((prev) => {
      const next = prev.filter((l) => l.code !== code);
      if (next.length === 0) {
        setDiagramShareable(false);
        setDiagramShareCode(null);
      } else if (diagramShareCode === code) {
        setDiagramShareCode(next[0]!.code);
      }
      return next;
    });
  };

  // Set or clear the diagram's share password (spec/24). A null / empty
  // value removes it. Persists through the api, reconciles page state
  // with the server-normalised value, and emits telemetry. Returns the
  // stored value so the dialog can reflect exactly what now gates access.
  const setDiagramSharePassword = async (password: string | null): Promise<string | null> => {
    if (!diagramId) return null;
    const trimmed = password && password.trim() ? password : null;
    try {
      const stored = await apiSetSharePassword(selfParticipant.id, diagramId, trimmed);
      setSharePassword(stored);
      // Telemetry (spec/22): the `type` is a preset, never the password.
      track('Diagram', 'Shared', stored ? 'PasswordSet' : 'PasswordCleared');
      return stored;
    } catch {
      // Network glitch — leave state alone. A real app would toast.
      return null;
    }
  };

  // Absolute share URL helper used by the dialog. Visitor links carry
  // the share code as a query param and land on the dedicated visitor
  // path; the editor page reads the code there. Router stitches /live
  // onto the app's hostname so this URL always resolves end-to-end.
  const shareUrlFor = (code: string) =>
    typeof window === 'undefined' ? '' : `${window.location.origin}/live/diagram/shared?s=${code}`;

  return {
    updateParticipantName,
    createShareLink,
    revokeShareLink,
    setDiagramSharePassword,
    shareUrlFor,
  };
}
