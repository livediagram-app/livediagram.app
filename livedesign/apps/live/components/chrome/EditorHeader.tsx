import {
  EditorHeader as SharedEditorHeader,
  type EditorHeaderProps as SharedEditorHeaderProps,
  type EditorHeaderWords,
} from '@liveworkspace/workbench/components/chrome/EditorHeader';
import { explorerItemHref } from '@liveworkspace/workbench/lib/explorer-href';
import { AuthControls } from '@/components/chrome/AuthControls';

export type { SaveStatus } from '@liveworkspace/workbench/components/chrome/EditorHeader';

const WORDS: EditorHeaderWords = {
  nameLabel: 'Design name',
  renameTitle: 'Rename design',
  copyDescription: 'Duplicate this design into your own files.',
};

type EditorHeaderProps = Omit<
  SharedEditorHeaderProps,
  'app' | 'logoHref' | 'words' | 'name' | 'team' | 'account' | 'shareAction' | 'present'
> & {
  // The open design's id: the logo opens the Explorer on the place that holds it
  // (liveworkspace/docs/specs/004-index/one-explorer.md "Opening from an open item").
  itemId?: string | null;
  designName: string;
  // The design lives in a team's shared library (docs/specs/013-workspace/team-shared-designs.md).
  teamDesign?: boolean;
  // Opens the editor's Settings on its Account category (the account menu's Account item), so it doesn't navigate
  // away from the design.
  onOpenAccount?: () => void;
};

// livedesign's header: the shared EditorHeader (docs/specs/007-editor/live-app.md "Header actions") with this
// app's logo, nouns and account control.
export function EditorHeader({
  itemId = null,
  designName,
  teamDesign = false,
  onOpenAccount,
  ...rest
}: EditorHeaderProps) {
  return (
    <SharedEditorHeader
      {...rest}
      app="livedesign"
      logoHref={explorerItemHref(itemId)}
      words={WORDS}
      name={designName}
      team={teamDesign}
      account={<AuthControls onOpenAccount={onOpenAccount} />}
    />
  );
}
