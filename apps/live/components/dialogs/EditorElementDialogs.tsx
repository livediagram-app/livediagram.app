'use client';

import dynamic from 'next/dynamic';
import { isBoxed, LINE_DEFAULT_CATEGORIES, LINE_DEFAULT_SERIES } from '@livediagram/diagram';

import { track } from '@/lib/telemetry';
import { useEditorContext } from '@/app/diagram/[id]/EditorContext';

const LinkPickerDialog = dynamic(() =>
  import('@/components/dialogs/LinkPickerDialog').then((m) => m.LinkPickerDialog),
);
const LineDataDialog = dynamic(() =>
  import('@/components/dialogs/LineDataDialog').then((m) => m.LineDataDialog),
);
const CodeEditDialog = dynamic(() =>
  import('@/components/dialogs/CodeEditDialog').then((m) => m.CodeEditDialog),
);
const ImagePicker = dynamic(() =>
  import('@/components/panels/ImagePicker').then((m) => m.ImagePicker),
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
    diagramList,
    diagramId,
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
    imagePickerOpenFor,
    selfParticipant,
    removeImageFromElement,
    applyImageToElement,
    closeImagePicker,
    refreshRecentImages,
  } = useEditorContext();

  return (
    <>
      {linkPickerOpenForId !== null && !isReadOnly ? (
        <LinkPickerDialog
          title="Link element"
          currentLink={activeTab.elements.find((e) => e.id === linkPickerOpenForId)?.link ?? null}
          tabs={tabs.map((t) => ({ id: t.id, name: t.name }))}
          currentTabId={activeId}
          initialMode={linkPickerInitialMode ?? undefined}
          recentDiagrams={diagramList
            .filter((d) => d.id !== diagramId)
            .slice(0, 8)
            .map((d) => ({ id: d.id, name: d.name }))}
          onCommit={(link) => {
            applyElementLink(link);
            if (link === null) track('Element', 'Unlinked');
            else
              track(
                'Element',
                'Linked',
                link.kind === 'url' ? 'Url' : link.kind === 'diagram' ? 'Diagram' : 'Tab',
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
          recentDiagrams={diagramList
            .filter((d) => d.id !== diagramId)
            .slice(0, 8)
            .map((d) => ({ id: d.id, name: d.name }))}
          onCommit={(link) => {
            applyCellLink(link);
            if (link === null) track('Element', 'Unlinked');
            else
              track(
                'Element',
                'Linked',
                link.kind === 'url' ? 'Url' : link.kind === 'diagram' ? 'Diagram' : 'Tab',
              );
          }}
          onClose={() => setCellLinkPickerOpenFor(null)}
        />
      ) : null}
      {/* Line-chart data modal (spec/53): edits the chart whose id is open. */}
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
      {/* Code block edit modal (spec/82): edits the block whose id is open. */}
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
      {imagePickerOpenFor && diagramId && !isReadOnly ? (
        <ImagePicker
          ownerId={selfParticipant.id}
          diagramId={diagramId}
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
            // just-uploaded image surfaces without a diagram reload.
            refreshRecentImages(selfParticipant.id);
          }}
          onClose={closeImagePicker}
        />
      ) : null}
    </>
  );
}
