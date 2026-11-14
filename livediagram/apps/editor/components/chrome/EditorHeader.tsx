import {
  EditorHeader as SharedEditorHeader,
  type EditorHeaderProps as SharedEditorHeaderProps,
  type EditorHeaderWords,
} from '@liveworkspace/workbench/components/chrome/EditorHeader';
import { explorerItemHref } from '@liveworkspace/workbench/lib/explorer-href';
import { AuthControls } from '@/components/chrome/AuthControls';

export type { SaveStatus } from '@liveworkspace/workbench/components/chrome/EditorHeader';

const WORDS: EditorHeaderWords = {
  nameLabel: 'Diagram name',
  renameTitle: 'Rename canvas',
  copyDescription: 'Duplicate this canvas into your own files.',
  presentLead: 'Present the slide deck',
};

type EditorHeaderProps = Omit<
  SharedEditorHeaderProps,
  'app' | 'logoHref' | 'words' | 'name' | 'team' | 'account' | 'shareAction'
> & {
  // The open canvas's id: the logo opens the Explorer on the place that holds it
  // (liveworkspace/docs/specs/004-index/one-explorer.md "Opening from an open item").
  itemId?: string | null;
  documentName: string;
  // The canvas lives in a team's shared library (docs/specs/013-workspace/team-shared-documents.md).
  teamDocument?: boolean;
  // Opens the editor's Settings on its Account category (the account menu's Account item), so it doesn't navigate
  // away from the canvas.
  onOpenAccount?: () => void;
};

// livediagram's header: the shared EditorHeader (docs/specs/007-editor/editor-app.md "Header actions") with this
// app's logo, nouns and account control, and the Present button while the deck has a presentable slide.
export function EditorHeader({
  itemId = null,
  documentName,
  teamDocument = false,
  onOpenAccount,
  ...rest
}: EditorHeaderProps) {
  return (
    <SharedEditorHeader
      {...rest}
      app="livediagram"
      logoHref={explorerItemHref(itemId)}
      words={WORDS}
      name={documentName}
      team={teamDocument}
      account={<AuthControls onOpenAccount={onOpenAccount} />}
    />
  );
}
