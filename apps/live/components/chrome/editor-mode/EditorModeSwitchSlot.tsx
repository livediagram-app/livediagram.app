import { useState } from 'react';
import { isEventStormingTab, type Tab } from '@livediagram/document';
import { EditorModeSwitch } from './EditorModeSwitch';
import type { EditorMode } from './editor-mode-copy';
import { useModeSwitchVariant } from './mode-switch-variant';

// The tab bar's mode switch slot (docs/specs/007-editor/editor-modes.md "The mode
// switch"): left end of the bar, before the TABS label. An event-storming
// board offers no switch, so its slot stays empty at the same width.
//
// PROTOTYPING: the mode is plain component state and the variant comes from
// `?modeSwitch=`; the per-person, per-tab editor mode replaces the state.
export function EditorModeSwitchSlot({ activeTab }: { activeTab: Tab | undefined }) {
  const variant = useModeSwitchVariant();
  const [mode, setMode] = useState<EditorMode>('diagram');
  return (
    <EditorModeSwitch
      variant={variant}
      hidden={isEventStormingTab(activeTab)}
      mode={mode}
      onChange={setMode}
    />
  );
}
