// The server-capability probe.
import type { CapabilitiesResponse } from '@livehuddle/api-schema';
import { createCapabilitiesClient } from '@liveworkspace/api-client';
import { API_BASE, apiFetch } from './core';

// Fetch server capabilities (the shared one-ask client, @liveworkspace/api-client): fail-closed (every
// feature off) on any network error so callers degrade gracefully, fetched once per page, and a failed
// answer is not kept, so the next caller asks again.
const capabilities = createCapabilitiesClient<CapabilitiesResponse>({
  request: () => apiFetch(`${API_BASE}/capabilities`),
  closed: { emailEnabled: false },
});

export const apiGetCapabilities = capabilities.get;

// Tests only: a fresh page.
export const resetCapabilitiesForTests = capabilities.reset;
