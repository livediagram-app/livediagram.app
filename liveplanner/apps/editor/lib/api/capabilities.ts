// The server-capability probe (GET /api/capabilities): which optional features this deployment has configured.
import type { CapabilitiesResponse } from '@liveplanner/api-schema';
import { API_BASE, apiFetch } from './core';

// Fetch server capabilities. Returns everything fail-closed (false) on any
// network error so callers degrade gracefully.
//
// Fetched once per page: the answer is deployment config, the same for every
// caller, and the editor and each Settings open both ask.
// A failed answer is not kept, so the next caller asks again.
let capabilities: Promise<CapabilitiesResponse> | null = null;

export function apiGetCapabilities(): Promise<CapabilitiesResponse> {
  capabilities ??= fetchCapabilities().then(({ caps, ok }) => {
    if (!ok) capabilities = null;
    return caps;
  });
  return capabilities;
}

// Tests only: a fresh page.
export function resetCapabilitiesForTests(): void {
  capabilities = null;
}

async function fetchCapabilities(): Promise<{ caps: CapabilitiesResponse; ok: boolean }> {
  const closed = { emailEnabled: false };
  try {
    const res = await apiFetch(`${API_BASE}/capabilities`);
    if (!res.ok) return { caps: closed, ok: false };
    return { caps: (await res.json()) as CapabilitiesResponse, ok: true };
  } catch {
    return { caps: closed, ok: false };
  }
}
