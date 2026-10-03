// Seeding for the Explorer Home specs (docs/specs/013-workspace/explorer-home.md): an owner with
// drawn documents and opens, and other people acting on one of them through an edit link, all
// through the api, as the product writes them.

import type { APIRequestContext, Page } from '@playwright/test';
import { expect, guestSigFor, mintSignedGuest, ownerHeaders } from './fixtures';

export const apiBase = process.env.NEXT_PUBLIC_API_BASE ?? '/api';

type Element = Record<string, unknown>;

export function box(id: string, label: string, x: number, y: number): Element {
  return { id, type: 'shape', shape: 'square', x, y, width: 200, height: 100, label };
}

/** A drawn document; returns its id and its first tab's id. */
export async function seedHomeDocument(
  request: APIRequestContext,
  owner: string,
  origin: string,
  name: string,
  elements: Element[] = [box('a', name, 40, 40), box('b', 'Next', 320, 160)],
): Promise<{ id: string; tabId: string }> {
  const id = crypto.randomUUID();
  const tabId = crypto.randomUUID();
  const res = await request.post(`${apiBase}/documents`, {
    headers: ownerHeaders(owner, { Origin: origin }),
    data: { id, name, tabs: [{ id: tabId, name: 'Tab 1', elements }] },
  });
  expect(res.ok(), `seeding ${name}: ${res.status()}`).toBe(true);
  return { id, tabId };
}

/** The editor's marked first-tab read: one open for today. */
export async function openDocument(
  request: APIRequestContext,
  owner: string,
  doc: { id: string; tabId: string },
): Promise<void> {
  const res = await request.get(`${apiBase}/documents/${doc.id}/tabs/${doc.tabId}`, {
    headers: ownerHeaders(owner, { 'X-Document-Open': '1' }),
  });
  expect(res.ok()).toBe(true);
}

export async function nameParticipant(
  request: APIRequestContext,
  id: string,
  name: string,
  color: string,
): Promise<void> {
  const res = await request.put(`${apiBase}/participants/${id}`, {
    headers: ownerHeaders(id),
    data: { name, color },
  });
  expect(res.ok()).toBe(true);
}

export async function editLink(
  request: APIRequestContext,
  owner: string,
  origin: string,
  id: string,
): Promise<string> {
  const res = await request.post(`${apiBase}/documents/${id}/share`, {
    headers: ownerHeaders(owner, { Origin: origin }),
    data: { role: 'edit' },
  });
  expect(res.ok()).toBe(true);
  return ((await res.json()) as { link: { code: string } }).link.code;
}

/** Someone else saves the tab through the edit link: an edit, and a comment when given. */
export async function visitorSaves(
  request: APIRequestContext,
  visitor: string,
  code: string,
  doc: { id: string; tabId: string },
  elements: Element[],
): Promise<void> {
  const res = await request.put(`${apiBase}/documents/${doc.id}/tabs/${doc.tabId}`, {
    headers: ownerHeaders(visitor, { 'X-Share-Code': code }),
    data: { id: doc.tabId, name: 'Tab 1', elements },
  });
  expect(res.ok(), `visitor save: ${res.status()}`).toBe(true);
}

export function commented(el: Element, id: string, text: string, author: string): Element {
  return {
    ...el,
    commentThread: {
      resolved: false,
      comments: [{ id, text, createdAt: Date.now(), authorName: author, authorColor: '#10b981' }],
    },
  };
}

/** A minted, signed guest who is a named person. */
export async function person(
  request: APIRequestContext,
  name: string,
  color: string,
): Promise<string> {
  const id = await mintSignedGuest(request);
  await nameParticipant(request, id, name, color);
  return id;
}

/** The browser as this guest, in dark mode. */
export async function asGuest(page: Page, owner: string): Promise<void> {
  await page.addInitScript(
    ({ id, sig }) => {
      localStorage.setItem('livediagram:v2:self-id', id);
      if (sig) localStorage.setItem('livediagram:v2:self-sig', sig);
      localStorage.setItem('livediagram:v2:name-confirmed', '1');
      localStorage.setItem('livediagram:v2:ui-mode', 'dark');
    },
    { id: owner, sig: guestSigFor(owner) },
  );
}

/**
 * An owner whose Home has everything: three drawn documents opened today, and on the first one
 * two other people at work (Priya comments, Sam edits), so What happened holds a summary.
 */
export async function seedBusyHome(
  request: APIRequestContext,
  origin: string,
): Promise<{ owner: string; payments: string; onboarding: string; roadmap: string }> {
  const owner = await mintSignedGuest(request);
  const payments = await seedHomeDocument(request, owner, origin, 'Payments architecture');
  const onboarding = await seedHomeDocument(request, owner, origin, 'Onboarding flow');
  const roadmap = await seedHomeDocument(request, owner, origin, 'Roadmap 2027');
  for (const doc of [payments, onboarding, roadmap]) await openDocument(request, owner, doc);

  const code = await editLink(request, owner, origin, payments.id);
  const priya = await person(request, 'Priya', '#8b5cf6');
  const sam = await person(request, 'Sam', '#f59e0b');
  const thread = commented(
    box('a', 'Payments architecture', 40, 40),
    crypto.randomUUID(),
    'Should the ledger be its own service?',
    'Priya',
  );
  await visitorSaves(request, priya, code, payments, [thread, box('b', 'Next', 320, 160)]);
  await visitorSaves(request, sam, code, payments, [thread, box('b', 'Ledger', 320, 160)]);
  return { owner, payments: payments.id, onboarding: onboarding.id, roadmap: roadmap.id };
}
