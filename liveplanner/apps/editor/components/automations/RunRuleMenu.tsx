'use client';

// Run Rule in a card's ⋯ menu (docs/specs/026-plan/automations.md "On cards"): a submenu headed Rules You Can Run
// Here, one row per Run from a Card rule that is on, then Manage Automations. Drawn by ItemPanelMenu inside its menu;
// useRunRule decides whether there is one.

import { MenuFlyoutSection } from '@liveworkspace/workbench/components/primitives/MenuFlyoutSection';
import {
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { lucideGlyph } from '@liveplanner/ui';
import { lucideSlidersHorizontal } from '@liveworkspace/icons/lucide';
import { BoltIcon } from './automation-glyphs';

const ManageIcon = lucideGlyph(lucideSlidersHorizontal, 16);

export type RunRuleChoices = {
  rules: readonly { id: string; name: string }[];
  onRun: (id: string) => void;
  onManage: () => void;
};

export function RunRuleMenu({ choices, close }: { choices: RunRuleChoices; close: () => void }) {
  const run = (fn: () => void) => () => {
    close();
    fn();
  };
  return (
    <MenuFlyoutSection plain title="Run Rule" icon={<BoltIcon />}>
      <MenuHeader title="Rules You Can Run Here" />
      {choices.rules.map((r) => (
        <MenuActionRow
          key={r.id}
          plain
          label={r.name}
          icon={<BoltIcon />}
          onClick={run(() => choices.onRun(r.id))}
        />
      ))}
      <MenuGroupSeparator />
      <MenuActionRow
        plain
        label="Manage Automations"
        icon={<ManageIcon />}
        onClick={run(choices.onManage)}
      />
    </MenuFlyoutSection>
  );
}
