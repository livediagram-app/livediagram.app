import type { ImportSource } from '@liveknowledge/knowledge-import';
import { ImportTrimmedNote } from './ImportTrimOffer';
import type { KnowledgeImportHost, RunImportResult } from '@/lib/knowledge-import/run-import';
import { ArchivePickStep } from './ArchivePickStep';
import type { DestinationPage } from './DestinationPicker';
import { ImportDoneStep } from './ImportDoneStep';
import { ImportProgressStep } from './ImportProgressStep';
import { ImportReviewStep } from './ImportReviewStep';
import { knowledgeSourceOf } from './sources';
import { useKnowledgeImport } from './useKnowledgeImport';

/** What the Import dialog hands a Knowledgebase import: the editor it writes through, the pages a destination is
 *  chosen from, and how the first imported page is opened. Present for an Editor only. */
export type KnowledgeImportProps = {
  host: KnowledgeImportHost;
  pages: readonly DestinationPage[];
  activePageId: string;
  /** Opens a page of `documentId` (the open knowledgebase, or the new one the import made). */
  onOpenPage: (documentId: string, pageId: string) => void;
  /** The write path, for a test; absent loads the real one when an import starts. */
  loadRunner?: Parameters<typeof useKnowledgeImport>[2];
};

// A Knowledgebase import inside the one Import dialog (docs/specs/020-import-export/knowledgebase-import.md): pick,
// review, import, done. Every step is the same height, so the dialog does not jump between them.
export function KnowledgeImportPanel({
  source: sourceKey,
  host,
  pages,
  activePageId,
  onOpenPage,
  loadRunner,
  onBack,
  onClose,
}: KnowledgeImportProps & {
  source: ImportSource;
  /** Back to the dialog's formats. */
  onBack: () => void;
  onClose: () => void;
}) {
  const source = knowledgeSourceOf(sourceKey);
  const { state, pick, setDestination, trim, start, cancel, reset } = useKnowledgeImport(
    sourceKey,
    host,
    loadRunner,
  );

  if (state.step === 'pick' || state.step === 'reading') {
    return (
      <ArchivePickStep
        source={source}
        reading={state.step === 'reading' ? state.archive.name : null}
        error={state.step === 'pick' ? state.error : null}
        onPick={pick}
        onBack={onBack}
      />
    );
  }
  if (state.step === 'review') {
    return (
      <ImportReviewStep
        source={source}
        archiveName={state.archive.name}
        plan={state.plan}
        destination={state.destination}
        replanning={state.replanning}
        bound={state.bound ?? null}
        pages={pages}
        activePageId={activePageId}
        onDestination={setDestination}
        onImport={() => void start()}
        onTrim={trim}
        onBack={reset}
      />
    );
  }
  if (state.step === 'importing') {
    return (
      <ImportProgressStep progress={state.progress} stopping={state.stopping} onCancel={cancel} />
    );
  }
  const result: RunImportResult = state.result;
  return (
    <>
      {state.leftOut ? (
        <ImportTrimmedNote
          imported={result.imported}
          leftOut={state.leftOut}
          bound={state.bound ?? null}
        />
      ) : null}
      <ImportDoneStep
        result={result}
        onOpen={(first) => {
          onOpenPage(result.documentId, first.id);
          onClose();
        }}
        onDone={onClose}
      />
    </>
  );
}
