'use client';

// Comment authors' profile pictures (docs/specs/014-identity/profile-picture.md §5, §6): read from
// the author's participant record, by the author id the comment already carries. The api returns a
// picture only to a signed-in caller, so an anonymous viewer never asks. One request per author per
// page, deduped in flight and cached, failures included (as "no picture").

import { useEffect, useSyncExternalStore } from 'react';
import { useDeferredAuth } from '@/components/providers/deferred-auth';
import { API_BASE, apiFetch, type ParticipantResponse } from '@/lib/api/core';
import { isProfilePictureUrl } from '@livediagram/api-schema';

const pictures = new Map<string, string | null>();
const inFlight = new Set<string>();
const listeners = new Set<() => void>();

function notify(): void {
  for (const l of listeners) l();
}

async function load(id: string): Promise<void> {
  if (pictures.has(id) || inFlight.has(id)) return;
  inFlight.add(id);
  try {
    const res = await apiFetch(`${API_BASE}/participants/${encodeURIComponent(id)}`);
    const body = res.ok ? ((await res.json()) as ParticipantResponse) : null;
    const url = body?.participant.pictureUrl;
    pictures.set(id, isProfilePictureUrl(url) ? url : null);
  } catch {
    pictures.set(id, null);
  } finally {
    inFlight.delete(id);
    notify();
  }
}

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

/** Test seam: forget every cached picture. */
export function resetParticipantPictures(): void {
  pictures.clear();
  inFlight.clear();
}

/**
 * The picture for a participant id, or null: always null for a guest viewer, and our own resolved
 * picture for our own id (own chrome, spec §4). Starts the lookup on first use.
 */
export function useParticipantPicture(id: string | undefined): string | null {
  const { isSignedIn, userId, user } = useDeferredAuth();
  const cached = useSyncExternalStore(
    subscribe,
    () => (id ? (pictures.get(id) ?? null) : null),
    () => null,
  );
  const lookUp = isSignedIn && !!id && id !== userId;
  useEffect(() => {
    if (lookUp && id) void load(id);
  }, [lookUp, id]);
  if (!isSignedIn || !id) return null;
  if (id === userId) return user?.pictureUrl ?? null;
  return cached;
}
