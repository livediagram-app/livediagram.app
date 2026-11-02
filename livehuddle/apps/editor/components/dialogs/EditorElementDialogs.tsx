'use client';

import { withArticle } from '@livehuddle/ui';
import dynamic from 'next/dynamic';
import {
  isBoxed,
  LINE_DEFAULT_CATEGORIES,
  LINE_DEFAULT_SERIES,
  EMBED_PROVIDER_HINT,
  EMBED_PROVIDER_LABEL,
  embedTargetFor,
  parseMindOutline,
  summariseMindOutline,
} from '@livehuddle/document';

import { track } from '@/lib/telemetry';
import { canEditSankey } from '@/lib/sankey-edit';
import { canEditSequence } from '@/lib/sequence-edit';
import { getTheme, themeChartPalette } from '@/lib/themes';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useCloseVanishedDialogs } from '@/components/dialogs/useCloseVanishedDialogs';

const LinkPickerDialog = dynamic(
  () => import('@/components/dialogs/LinkPickerDialog').then((m) => m.LinkPickerDialog),
  { ssr: false },
);
const LineDataDialog = dynamic(
  () => import('@/components/dialogs/LineDataDialog').then((m) => m.LineDataDialog),
  { ssr: false },
);
const MindOutlineDialog = dynamic(
  () => import('@/components/dialogs/MindOutlineDialog').then((m) => m.MindOutlineDialog),
  { ssr: false },
);
const CodeEditDialog = dynamic(
  () => import('@/components/dialogs/CodeEditDialog').then((m) => m.CodeEditDialog),
  { ssr: false },
);
const SequenceDialog = dynamic(
  () => import('@/components/dialogs/SequenceDialog').then((m) => m.SequenceDialog),
  { ssr: false },
);
const SankeyFlowsDialog = dynamic(
  () => import('@/components/dialogs/SankeyFlowsDialog').then((m) => m.SankeyFlowsDialog),
  { ssr: false },
);
const ImagePicker = dynamic(
  () => import('@/components/panels/ImagePicker').then((m) => m.ImagePicker),
  { ssr: false },
);

// Dialogs that edit a single element's data: its link (element + table
// cell), a line/bar chart's series, and its image. Each is gated on the
// matching "open for id" state and reads everything from EditorContext, so
// EditorView just renders <EditorElementDialogs />. Distinct from the
// global modals (EditorModals) and the tab/share dialogs (EditorTabDialogs).
export function EditorElementDialogs() {
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
    sequenceOpenForId,
    setSequenceOpenForId,
    sankey,
    sequence,
    mindOutline,
    imagePickerOpenFor,
    selfParticipant,
    removeImageFromElement,
    applyImageToElement,
    closeImagePicker,
    refreshRecentImages,
    workbenchMode,
    can,
  } = useEditorContext();

  // Each dialog closes whenever its own render check below fails, not only when its element goes: hidden by a lock
  // or a role change, it would otherwise reopen by itself when that is undone. Edit Outline closes itself
  // (useMindOutline), so it is not listed.
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
      [
        sequenceOpenForId,
        () => setSequenceOpenForId(null),
        (el) => el.type === 'shape' && el.shape === 'sequence' && canEditSequence(can, el),
      ],
      [
        imagePickerOpenFor?.forElementId ?? null,
        closeImagePicker,
        () => !isReadOnly || !!can.addContent,
      ],
    ],
    `${isReadOnly}|${can.level}|${!!can.addContent}`,
  );

  // A video's link IS its content (docs/specs/009-elements/youtube-video.md), so its picker is the URL mode
  // only, validated as a YouTube link. Every other element keeps the full
  // tab / document / URL choice.
  const linkTarget = activeTab.elements.find((e) => e.id === linkPickerOpenForId);
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
      {linkPickerOpenForId !== null && !isReadOnly ? (
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
      {/* Edit Outline (docs/specs/009-elements/mind-node.md "Edit Outline"): the open root's map as text. */}
      {mindOutline.openForId !== null && !isReadOnly ? (
        <MindOutlineDialog
          key={mindOutline.openForId}
          initialText={mindOutline.text()}
          summarise={(text) => {
            const outline = parseMindOutline(text);
            return outline
              ? summariseMindOutline(activeTab.elements, mindOutline.openForId!, outline)
              : null;
          }}
          onSave={mindOutline.save}
          onClose={mindOutline.close}
        />
      ) : null}
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
      {/* The Sequence dialog (docs/specs/009-elements/sequence-diagram.md "The Sequence dialog"): an Editor's, on
          an unlocked diagram; it closes itself if the diagram goes (deleted, or the tab changed). */}
      {sequenceOpenForId !== null
        ? (() => {
            const el = activeTab.elements.find((e) => e.id === sequenceOpenForId);
            if (!el || el.type !== 'shape' || el.shape !== 'sequence' || !canEditSequence(can, el))
              return null;
            return (
              <SequenceDialog
                key={el.id}
                element={el}
                onCommit={(rows, type) => sequence.setSequenceRows(el.id, rows, type)}
                onNumbered={(on) => sequence.setSequenceNumbered(el.id, on)}
                onClose={() => setSequenceOpenForId(null)}
              />
            );
          })()
        : null}
      {/* A Participant places images and swaps their pictures (docs/specs/013-workspace/share-roles.md). */}
      {imagePickerOpenFor && documentId && (!isReadOnly || can.addContent) ? (
        <ImagePicker
          ownerId={selfParticipant.id}
          documentId={documentId}
          uploadOnly={workbenchMode}
          forElementId={imagePickerOpenFor.forElementId}
          currentImageId={(() => {
            const targetId = imagePickerOpenFor.forElementId;
            if (!targetId) return null;
            const el = activeTab.elements.find((e) => e.id === targetId);
            return el && isBoxed(el) && el.type === 'image' ? el.imageId : null;
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
