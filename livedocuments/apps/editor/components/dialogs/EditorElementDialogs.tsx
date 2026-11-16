'use client';

import { withArticle } from '@livedocuments/ui';
import dynamic from 'next/dynamic';
import {
  elementImageId,
  LINE_DEFAULT_CATEGORIES,
  LINE_DEFAULT_SERIES,
  EMBED_PROVIDER_HINT,
  EMBED_PROVIDER_LABEL,
  embedTargetFor,
} from '@livedocuments/document';

import { track } from '@/lib/telemetry';
import { indexClient } from '@liveworkspace/workbench/lib/index-client';
import { connectedTargets } from '@liveworkspace/workbench/components/connect/tab-connection';
import { canEditSankey } from '@/lib/sankey-edit';
import { canEditMap } from '@/lib/map-edit';
import {
  MAP_DEFAULT_ACCENT,
  chartPageGrounds,
  isLightColor,
  mapPaperColour,
  resolveStockColours,
} from '@livedocuments/document';
import { getTheme, themeChartPalette } from '@/lib/themes';
import { useEditorChrome, useEditorContext } from '@/app/document/[id]/EditorContext';
import { useCloseVanishedDialogs } from '@/components/dialogs/useCloseVanishedDialogs';

const LiveEmbedPicker = dynamic(
  () =>
    import('@liveworkspace/workbench/components/live-embed/LiveEmbedPicker').then(
      (m) => m.LiveEmbedPicker,
    ),
  { ssr: false },
);
const LinkPickerDialog = dynamic(
  () => import('@/components/dialogs/LinkPickerDialog').then((m) => m.LinkPickerDialog),
  { ssr: false },
);
const LineDataDialog = dynamic(
  () => import('@/components/dialogs/LineDataDialog').then((m) => m.LineDataDialog),
  { ssr: false },
);
const CodeEditDialog = dynamic(
  () => import('@/components/dialogs/CodeEditDialog').then((m) => m.CodeEditDialog),
  { ssr: false },
);
const SankeyFlowsDialog = dynamic(
  () => import('@/components/dialogs/SankeyFlowsDialog').then((m) => m.SankeyFlowsDialog),
  { ssr: false },
);
const MapDialog = dynamic(() => import('@/components/dialogs/MapDialog').then((m) => m.MapDialog), {
  ssr: false,
});
const ImagePicker = dynamic(
  () => import('@/components/panels/ImagePicker').then((m) => m.ImagePicker),
  { ssr: false },
);

// Dialogs that edit a single element's data: its link (element + table
// cell), a line/bar chart's series, and its image. Each is gated on the
// matching "open for id" state and reads everything from EditorContext, so
// EditorView just renders <EditorElementDialogs />. Distinct from the
// global modals (EditorModals) and the tab/share dialogs (EditorTabDialogs).
// The element dialogs, open or not.
// Only whether one is open is read until it is (docs/specs/007-editor/blueprints/flashcards.md "Performance and
// limits"): a typing commit renders nothing here.
export function EditorElementDialogs() {
  const open = useEditorChrome(
    (s) =>
      !!s.linkPickerOpenForId ||
      !!s.cellLinkPickerOpenFor ||
      !!s.lineDataOpenForId ||
      !!s.codeEditOpenForId ||
      !!s.sankeyFlowsOpenForId ||
      !!s.mapDialogOpenForId ||
      !!s.imagePickerOpenFor,
  );
  return open ? <OpenEditorElementDialogs /> : null;
}

function OpenEditorElementDialogs() {
  const {
    linkPickerOpenForId,
    isReadOnly,
    activeTab,
    tabs,
    activeId,
    linkPickerInitialMode,
    documentList,
    documentId,
    applyElementLink,
    applyLiveEmbed,
    setLinkPickerOpenForId,
    cellLinkPickerOpenFor,
    applyCellLink,
    setCellLinkPickerOpenFor,
    lineDataOpenForId,
    setLineDataSelected,
    setLineDataOpenForId,
    codeEditOpenForId,
    setCodeSelected,
    setCodeEditOpenForId,
    sankeyFlowsOpenForId,
    setSankeyFlowsOpenForId,
    sankey,
    mapDialogOpenForId,
    setMapDialogOpenForId,
    mapEdits,
    imagePickerOpenFor,
    selfParticipant,
    removeImageFromElement,
    applyImageToElement,
    closeImagePicker,
    refreshRecentImages,
    workbenchMode,
    can,
    pagesMode,
  } = useEditorContext();

  // Each dialog closes whenever its own render check below fails, not only when its element goes: hidden by a lock
  // or a role change, it would otherwise reopen by itself when that is undone.
  const editable = () => !isReadOnly;
  useCloseVanishedDialogs(
    activeTab.elements,
    [
      [linkPickerOpenForId, () => setLinkPickerOpenForId(null), editable],
      [
        cellLinkPickerOpenFor?.tableId ?? null,
        () => setCellLinkPickerOpenFor(null),
        (el) => !isReadOnly && el.type === 'table',
      ],
      [
        lineDataOpenForId,
        () => setLineDataOpenForId(null),
        (el) => !isReadOnly && el.type === 'shape',
      ],
      [
        codeEditOpenForId,
        () => setCodeEditOpenForId(null),
        (el) => !isReadOnly && el.type === 'shape',
      ],
      [
        sankeyFlowsOpenForId,
        () => setSankeyFlowsOpenForId(null),
        (el) => el.type === 'shape' && el.shape === 'sankey' && canEditSankey(can, el),
      ],
      [mapDialogOpenForId, () => setMapDialogOpenForId(null), (el) => canEditMap(can, el)],
      [imagePickerOpenFor?.forElementId ?? null, closeImagePicker, () => !isReadOnly],
    ],
    `${isReadOnly}|${can.level}`,
  );

  // A video's link IS its content (docs/specs/009-elements/youtube-video.md), so its picker is the URL mode
  // only, validated as a YouTube link. Every other element keeps the full
  // tab / document / URL choice.
  const linkTarget = activeTab.elements.find((e) => e.id === linkPickerOpenForId);
  // A live embed chooses a file, not a link (liveworkspace/docs/specs/004-index/live-embeds.md "Making one").
  const liveEmbedTarget = linkTarget?.type === 'video' && linkTarget.embedProvider === 'live';
  // The provider the embed was created for, when it came from one of the
  // provider tiles (docs/specs/009-elements/embed-providers.md). Names the dialog; the validator still accepts
  // ANY supported link, because refusing one that plainly works is pedantry.
  const embedNamed =
    linkTarget?.type === 'video' && linkTarget.embedProvider
      ? EMBED_PROVIDER_LABEL[linkTarget.embedProvider]
      : null;
  // A website embed (docs/specs/009-elements/website-embed.md) is a free address, not a link into a named
  // service, so its dialog says so: a YouTube watch-url placeholder under a
  // field labelled "Website link" is just misleading.
  const isWebsiteEmbed = linkTarget?.type === 'video' && linkTarget.embedProvider === 'website';
  const urlOnly =
    linkTarget?.type === 'video'
      ? {
          subtitle: isWebsiteEmbed
            ? 'Paste any web address. The page loads right here on the canvas.'
            : embedNamed
              ? `Paste ${withArticle(embedNamed)} link. It loads right here on the canvas.`
              : 'Paste a link. The content plays or loads right here on the canvas.',
          fieldLabel: isWebsiteEmbed
            ? 'Web address'
            : embedNamed
              ? `${embedNamed} link`
              : 'Embed link',
          placeholder: isWebsiteEmbed
            ? 'https://www.bbc.co.uk'
            : 'https://www.youtube.com/watch?v=…',
          hint: embedNamed
            ? EMBED_PROVIDER_HINT[linkTarget.embedProvider!]
            : 'YouTube, Vimeo, Loom, Figma, Google Docs / Sheets / Slides, or any website.',
          validate: (url: string) =>
            embedTargetFor(url)
              ? null
              : "That isn't a link we can embed. Check it starts with https://, or, for a named service, that it is a link to a real file.",
        }
      : undefined;

  return (
    <>
      {linkPickerOpenForId !== null && liveEmbedTarget && !isReadOnly && documentId ? (
        <LiveEmbedPicker
          client={indexClient}
          hostId={documentId}
          connectedIds={[...connectedTargets(tabs).keys()]}
          onChoose={(choice) => {
            applyLiveEmbed(choice);
            track('Element', 'Added', 'LiveEmbed');
          }}
          onClose={() => setLinkPickerOpenForId(null)}
        />
      ) : null}
      {linkPickerOpenForId !== null && !isReadOnly && !liveEmbedTarget ? (
        <LinkPickerDialog
          title={linkTarget?.type === 'video' ? 'Link embed' : 'Link element'}
          urlOnly={urlOnly}
          currentLink={linkTarget?.link ?? null}
          tabs={tabs.map((t) => ({ id: t.id, name: t.name }))}
          currentTabId={activeId}
          initialMode={linkPickerInitialMode ?? undefined}
          recentDocuments={documentList
            .filter((d) => d.id !== documentId)
            .slice(0, 8)
            .map((d) => ({ id: d.id, name: d.name }))}
          onCommit={(link) => {
            applyElementLink(link);
            if (link === null) track('Element', 'Unlinked');
            else
              track(
                'Element',
                'Linked',
                link.kind === 'url' ? 'Url' : link.kind === 'document' ? 'Document' : 'Tab',
              );
          }}
          onClose={() => setLinkPickerOpenForId(null)}
        />
      ) : null}
      {cellLinkPickerOpenFor !== null && !isReadOnly ? (
        <LinkPickerDialog
          title="Link cell"
          currentLink={(() => {
            const t = activeTab.elements.find(
              (e) => e.id === cellLinkPickerOpenFor.tableId && e.type === 'table',
            );
            return t && t.type === 'table'
              ? (t.cellStyles?.[cellLinkPickerOpenFor.r]?.[cellLinkPickerOpenFor.c]?.link ?? null)
              : null;
          })()}
          tabs={tabs.map((t) => ({ id: t.id, name: t.name }))}
          currentTabId={activeId}
          recentDocuments={documentList
            .filter((d) => d.id !== documentId)
            .slice(0, 8)
            .map((d) => ({ id: d.id, name: d.name }))}
          onCommit={(link) => {
            applyCellLink(link);
            if (link === null) track('Element', 'Unlinked');
            else
              track(
                'Element',
                'Linked',
                link.kind === 'url' ? 'Url' : link.kind === 'document' ? 'Document' : 'Tab',
              );
          }}
          onClose={() => setCellLinkPickerOpenFor(null)}
        />
      ) : null}
      {/* Line-chart data modal (docs/specs/009-elements/pie-chart.md): edits the chart whose id is open. */}
      {lineDataOpenForId !== null && !isReadOnly
        ? (() => {
            const el = activeTab.elements.find((e) => e.id === lineDataOpenForId);
            if (!el || el.type !== 'shape') return null;
            return (
              <LineDataDialog
                categories={el.lineCategories ?? [...LINE_DEFAULT_CATEGORIES]}
                series={
                  el.lineSeries ?? LINE_DEFAULT_SERIES.map((s) => ({ ...s, values: [...s.values] }))
                }
                onCommit={setLineDataSelected}
                onClose={() => setLineDataOpenForId(null)}
              />
            );
          })()
        : null}
      {/* Code block edit modal (docs/specs/009-elements/code-block.md): edits the block whose id is open. */}
      {codeEditOpenForId !== null && !isReadOnly
        ? (() => {
            const el = activeTab.elements.find((e) => e.id === codeEditOpenForId);
            if (!el || el.type !== 'shape') return null;
            return (
              <CodeEditDialog
                code={el.code ?? ''}
                language={el.codeLanguage ?? 'plain'}
                onCommit={setCodeSelected}
                onClose={() => setCodeEditOpenForId(null)}
              />
            );
          })()
        : null}
      {/* Sankey Flows dialog (docs/specs/009-elements/sankey.md "The Flows dialog"): an Editor's, on an
          unlocked diagram; it closes itself if the diagram goes (deleted, or the tab changed). */}
      {sankeyFlowsOpenForId !== null
        ? (() => {
            const el = activeTab.elements.find((e) => e.id === sankeyFlowsOpenForId);
            if (!el || el.type !== 'shape' || el.shape !== 'sankey' || !canEditSankey(can, el))
              return null;
            return (
              <SankeyFlowsDialog
                key={el.id}
                element={el}
                palette={themeChartPalette(getTheme(activeTab.theme))}
                onCommit={(flows, nodes) => sankey.setSankeyFlows(el.id, flows, nodes)}
                onClose={() => setSankeyFlowsOpenForId(null)}
              />
            );
          })()
        : null}
      {/* Map dialog (docs/specs/009-elements/map.md "The Map dialog"): an Editor's, on an unlocked map. */}
      {mapDialogOpenForId !== null
        ? (() => {
            const el = activeTab.elements.find((e) => e.id === mapDialogOpenForId);
            if (!el || el.type !== 'shape' || !canEditMap(can, el)) return null;
            // What the map sits on, as the canvas finds it (PageClip's chartPageGrounds): the preview follows its page.
            const ground = pagesMode
              ? chartPageGrounds(activeTab.elements, pagesMode.pages, activeTab.layers).get(el.id)
              : undefined;
            // The accent is the stock colour's version for the paper the preview is drawn on.
            const surface = isLightColor(mapPaperColour('light', ground)) ? 'light' : 'dark';
            const accent = resolveStockColours(el, surface).strokeColor ?? MAP_DEFAULT_ACCENT;
            return (
              <MapDialog
                key={el.id}
                element={el}
                accent={accent}
                ground={ground}
                onCommit={(patch) => mapEdits.setMap(el.id, patch)}
                onClose={() => setMapDialogOpenForId(null)}
              />
            );
          })()
        : null}
      {imagePickerOpenFor && documentId && !isReadOnly ? (
        <ImagePicker
          ownerId={selfParticipant.id}
          documentId={documentId}
          uploadOnly={workbenchMode}
          forElementId={imagePickerOpenFor.forElementId}
          currentImageId={(() => {
            const targetId = imagePickerOpenFor.forElementId;
            if (!targetId) return null;
            const el = activeTab.elements.find((e) => e.id === targetId);
            return el ? elementImageId(el) : null;
          })()}
          onRemove={
            imagePickerOpenFor.forElementId
              ? () => removeImageFromElement(imagePickerOpenFor.forElementId!)
              : undefined
          }
          onSelect={(image) => {
            if (imagePickerOpenFor.forElementId) {
              applyImageToElement(imagePickerOpenFor.forElementId, image);
            } else {
              closeImagePicker();
            }
            // Refresh the Current Tab → Images accordion so the
            // just-uploaded image surfaces without a document reload.
            refreshRecentImages(selfParticipant.id);
          }}
          onClose={closeImagePicker}
        />
      ) : null}
    </>
  );
}
