// Switch the editor to a tab, dropping every per-tab piece of selection state
// (@liveworkspace/workbench/hooks/editor/useSelectTab), on this editor's context.
import { createUseSelectTab } from '@liveworkspace/workbench/hooks/editor/useSelectTab';
import { useEditorContext } from './EditorContext';

export const useSelectTab = createUseSelectTab(useEditorContext);
