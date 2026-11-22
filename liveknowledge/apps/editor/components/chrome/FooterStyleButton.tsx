'use client';

// Style in the footer, left of Tools (docs/specs/030-knowledgebase/page-surface.md "Knowledgebase Style"; owner
// 2026-11-21: moved out of the knowledgebase's menu): opens Knowledgebase Style for whoever may change it, an Editor
// of the whole knowledgebase. Nothing for anyone else, nor outside the editor (the Explorer's bar has no store).
import { useContext } from 'react';
import { HoverCard } from '@liveknowledge/ui';
import {
  CHROME_BTN,
  CHROME_BTN_LABELLED,
  ChromeLabel,
} from '@liveworkspace/workbench/components/chrome/chrome-button';
import { EditorChromeContext } from '@/app/document/[id]/EditorContext';
import { StyleIcon } from '@/components/knowledge-menu/knowledge-menu-icons';
import { useStyleOffered } from '@/components/knowledge-style/useStyleOffered';
import { track } from '@/lib/telemetry';

export function FooterStyleButton({ labelled }: { labelled: boolean }) {
  const store = useContext(EditorChromeContext);
  const offered = useStyleOffered();
  if (!store || !offered) return null;
  return (
    <HoverCard title="Style" description="The look of every page in this knowledgebase.">
      <button
        type="button"
        aria-label="Style"
        data-footer-style=""
        onClick={() => {
          track('UI', 'Opened', 'ThemePicker');
          store.get().setCanvasThemeTab('looks');
        }}
        className={labelled ? `${CHROME_BTN} ${CHROME_BTN_LABELLED}` : CHROME_BTN}
      >
        <StyleIcon />
        <ChromeLabel show={labelled}>Style</ChromeLabel>
      </button>
    </HoverCard>
  );
}
