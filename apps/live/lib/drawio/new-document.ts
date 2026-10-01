// A draw.io file as a document of its own (docs/specs/020-import-export/drawio-import.md "Import as
// new documents"): its pages become diagram tabs in page order, its embedded images go through the
// import image pipeline in one pass, and its report is the shared one. The foundation's new-document
// target (importDocuments) makes the document.

import type { Tab } from '@livediagram/document';
import type { ImportDocumentSource } from '@/lib/board-scene-import';
import { browserImageSession, type CreateImageSession } from '@/lib/board-scene-browser';
import { attachImportImages, type ImportImageRequest } from '@/lib/import-images';
import { attachDrawioImages } from './images';
import type { ImportedPage } from './import';
import type { DrawioReport } from './notes';
import { drawioSceneReport } from './report';

/** An imported draw.io file, named and dated for its document. */
export type DrawioDocumentFile = {
  name: string;
  createdAt?: string;
  modifiedAt?: string;
  pages: ImportedPage[];
  images: ImportImageRequest[];
  report: DrawioReport;
};

export function drawioDocumentSource(
  file: DrawioDocumentFile,
  o: { ownerId: string; offline: boolean; createImageSession?: CreateImageSession },
): ImportDocumentSource {
  // Nothing in a draw.io file records when it was made: created is its last-modified moment.
  const createdAt = file.createdAt ?? file.modifiedAt;
  return {
    name: file.name,
    kind: 'diagram',
    ...(createdAt !== undefined ? { createdAt } : {}),
    ...(file.modifiedAt !== undefined ? { modifiedAt: file.modifiedAt } : {}),
    prepare: async (onProgress) => {
      const { pages, images } = await attachDrawioImages(
        file.pages,
        file.images,
        async (elements, requests) => {
          const session = await (o.createImageSession ?? browserImageSession)({
            ownerId: o.ownerId,
            documentId: null,
            offline: o.offline,
          });
          return attachImportImages(elements, requests, session, onProgress);
        },
      );
      const tabs: Tab[] = pages.map((page) => ({
        id: page.tabId,
        name: page.name,
        elements: page.elements,
        ...(page.layers ? { layers: page.layers } : {}),
        ...(page.backgroundColor ? { backgroundColor: page.backgroundColor } : {}),
        templateChosen: true,
      }));
      return {
        tabs,
        report: drawioSceneReport(file.report, pages),
        ...(images ? { images } : {}),
      };
    },
  };
}
