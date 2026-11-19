// The Fine-tune rows Tab Style ends with on a Board, Sheet, Form or Dashboard tab (docs/specs/011-theme/
// canvas-and-theme-dialog.md "One dialog, this editor's profile"): the settings outside the dialog that really style
// that kind of tab. Each runs after the dialog has closed. Configure is opened through its store; a Sheet's, a Form's
// and a Dashboard's settings live behind their own cog, so the row presses that cog, which anchors its popover as a
// press does, asking first for the section that styles it (lib/settings-open-on.ts). A cog not on screen (none for a
// viewer, a Sheet scrolled off, a form in Preview) leaves the press doing nothing, and its ask is dropped.
import type { TabStyleLink } from '@liveworkspace/workbench/components/dialogs/tab-style/tab-style-profile';
import { setBoardConfiguring } from '@/hooks/plan/board-configure-store';
import { requestOpenOn, type SettingsCogName } from './settings-open-on';

const pressCog = (selector: string, on?: { cog: SettingsCogName; section: string }) => () => {
  const cog = document.querySelector<HTMLButtonElement>(selector);
  if (on) requestOpenOn(on.cog, cog ? on.section : null);
  cog?.click();
};

export const BOARD_CONFIGURE_LINK: TabStyleLink = {
  id: 'board-configure',
  label: 'Board Configure',
  value: 'Columns, cards and density',
  onOpen: () => setBoardConfiguring(true),
};

export const SHEET_SETTINGS_LINK: TabStyleLink = {
  id: 'sheet-settings',
  label: 'Sheet Settings',
  value: 'Gridlines, headers and cell sizes',
  // On Sheet Options, where Gridlines and the headers are.
  onOpen: pressCog('[data-plan-sheet] button[aria-label="Sheet Settings"]', {
    cog: 'sheet',
    section: 'view',
  }),
};

export const FORM_SETTINGS_LINK: TabStyleLink = {
  id: 'form-settings',
  label: 'Form Settings',
  value: 'Width, messages and taking responses',
  // On its Settings, where Layout's Width is.
  onOpen: pressCog('[data-form-status] button[aria-label="Form Settings"]', {
    cog: 'form',
    section: 'settings',
  }),
};

export const DASHBOARD_SETTINGS_LINK: TabStyleLink = {
  id: 'dashboard-settings',
  label: 'Dashboard Settings',
  value: 'Layout, tint and slots',
  onOpen: pressCog('[data-dashboard-settings] button[aria-label="Dashboard Settings"]'),
};
