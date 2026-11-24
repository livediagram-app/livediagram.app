// Send to Knowledge Base, livediagram's side (docs/specs/013-workspace/send-to-knowledge.md): the open tab the
// selection is read from, the capture the toolbars and the element menu hand the picker, and the summariser that asks
// this app's `POST /api/documents/<id>/knowledge-summary`. The editor sets the tab source while it shows a canvas
// (EditorView); the entries read it only when pressed, so nothing is captured while the selection rests.
import type {
  KnowledgeCapture,
  KnowledgeSummariser,
  KnowledgeSummaryAnswer,
} from '@liveworkspace/workbench/components/send-to-knowledge/send-to-knowledge-entry';
import { ensureIconCatalogs } from '@liveworkspace/workbench/lib/icon-registry';
import type { Tab } from '@livediagram/document';
import { API_BASE, apiFetch } from '@/lib/api/core';
import type { ImageExportOpts } from '@/lib/export-tab';
import { captureKnowledgeSelection, pictureWithin, selectionTab } from '@/lib/knowledge-selection';

type TabSource = {
  tab: () => Tab;
  // The tab's image and avatar bitmaps, for the picture; undefined draws their placeholders.
  images: (tab: Tab) => Promise<ImageExportOpts['images']>;
};

let source: TabSource | null = null;

/** The editor's open tab while a canvas shows; null when it closes. */
export function setKnowledgeTabSource(next: TabSource | null): void {
  source = next;
}

/** The selection with these ids, ready for the picker; null without an open tab or a selection. */
export function captureSelected(ids: Iterable<string>): KnowledgeCapture | null {
  const from = source;
  if (!from) return null;
  const tab = from.tab();
  const selected = new Set(ids);
  if (selected.size === 0) return null;
  const { selection, elementIds, heading } = captureKnowledgeSelection(tab.elements, selected);
  if (elementIds.length === 0) return null;
  return {
    tabId: tab.id,
    elementIds,
    selection,
    heading,
    picture: async () => {
      // The selection as Export Selection draws it, in the appearance the person is looking at. The drawing code
      // loads on the picker's first open, never with the canvas.
      const [{ tabAsSeen }, { renderTabToCanvas }] = await Promise.all([
        import('@/lib/export-as-seen'),
        import('@/lib/export-tab'),
      ]);
      const part = tabAsSeen(selectionTab(tab, selected));
      await ensureIconCatalogs();
      const images = await from.images(part).catch(() => undefined);
      return pictureWithin((scale) => renderTabToCanvas(part, { scale, images }));
    },
  };
}

const failed = (message: string): KnowledgeSummaryAnswer => ({
  ok: false,
  error: 'summary_failed',
  message,
});

/** This canvas's summariser, on its team's key, the person's own, or built-in AI. */
export function knowledgeSummariser(
  documentId: string,
  teamId: string | null,
): KnowledgeSummariser {
  return async ({ tabId, selection, focus }) => {
    const res = await apiFetch(
      `${API_BASE}/documents/${encodeURIComponent(documentId)}/knowledge-summary`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tabId,
          selection,
          ...(focus ? { focus } : {}),
          ...(teamId ? { teamId } : {}),
        }),
      },
    );
    const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    if (res.ok && typeof body?.markdown === 'string') return { ok: true, markdown: body.markdown };
    if (!body || typeof body.error !== 'string')
      return failed("Couldn't write the summary. Try again, or add it without one.");
    const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
    return {
      ok: false,
      error: body.error,
      message: typeof body.message === 'string' ? body.message : "Couldn't write the summary.",
      ...(body.limit === 'aiCreditsPerMonth' ? { limit: 'aiCreditsPerMonth' as const } : {}),
      ...(typeof body.owner === 'string' ? { owner: body.owner } : {}),
      ...(num(body.used) !== undefined ? { used: num(body.used) } : {}),
      ...(num(body.max) !== undefined ? { max: num(body.max) } : {}),
    };
  };
}
