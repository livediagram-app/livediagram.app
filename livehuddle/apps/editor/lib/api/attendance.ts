import type { TabAttendanceResponse } from '@livehuddle/api-schema';
import { API_BASE, apiFetch, apiHeaders, expectOk } from './core';

// A tab's Attendance (docs/specs/012-collaboration/tab-attendance.md "The wire"): who was in the tab and when, for an
// Editor or a Participant. The room records it; this only reads it.

export async function apiListAttendance(
  ownerId: string,
  documentId: string,
  tabId: string,
  shareCode: string | null = null,
): Promise<TabAttendanceResponse> {
  const res = await apiFetch(
    `${API_BASE}/documents/${encodeURIComponent(documentId)}/tabs/${encodeURIComponent(tabId)}/attendance`,
    { headers: await apiHeaders(ownerId, { share: shareCode }) },
  );
  return expectOk<TabAttendanceResponse>(res, 'list attendance');
}
