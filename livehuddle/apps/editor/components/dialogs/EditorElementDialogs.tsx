'use client';

import dynamic from 'next/dynamic';
import { isBoxed } from '@livehuddle/document';

import { track } from '@/lib/telemetry';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { useCloseVanishedDialogs } from '@/components/dialogs/useCloseVanishedDialogs';

const LinkPickerDialog = dynamic(
  () => import('@/components/dialogs/LinkPickerDialog').then((m) => m.LinkPickerDialog),
  { ssr: false },
);
const ImagePicker = dynamic(
  () => import('@/components/panels/ImagePicker').then((m) => m.ImagePicker),
  { ssr: false },
);

// Dialogs that edit a single element's data: its link (element + table
// cell) and its image. Each is gated on the
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
    imagePickerOpenFor,
    selfParticipant,
    removeImageFromElement,
    applyImageToElement,
    closeImagePicker,
    refreshRecentImages,
    can,
  } = useEditorContext();

  // Each dialog closes whenever its own render check below fails, not only when its element goes: hidden by a role
  // change, it would otherwise reopen by itself when that is undone.
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
        imagePickerOpenFor?.forElementId ?? null,
        closeImagePicker,
        () => !isReadOnly || !!can.addContent,
      ],
    ],
    `${isReadOnly}|${can.level}|${!!can.addContent}`,
  );

  const linkTarget = activeTab.elements.find((e) => e.id === linkPickerOpenForId);

  return (
    <>
      {linkPickerOpenForId !== null && !isReadOnly ? (
        <LinkPickerDialog
          title="Link element"
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
      {/* A Participant places images and swaps their pictures (docs/specs/013-workspace/share-roles.md). */}
      {imagePickerOpenFor && documentId && (!isReadOnly || can.addContent) ? (
        <ImagePicker
          ownerId={selfParticipant.id}
          documentId={documentId}
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
