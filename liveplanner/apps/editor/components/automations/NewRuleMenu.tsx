'use client';

// The screen's New Rule (docs/specs/026-plan/automations.md "The Automations screen", "Describe a Rule"): a menu of a
// Blank Rule, built step by step, Start From a Template, which opens the Templates tab, and Describe a Rule, which
// drafts one from words with AI. Disabled while the list loads and once the plan holds its 50 rules.

import { useState } from 'react';
import { Button, ChevronDownIcon, PlusIcon, SparkleIcon, lucideGlyph } from '@liveplanner/ui';
import { lucideFilePlus, lucideLayoutGrid } from '@liveworkspace/icons/lucide';
import {
  MenuActionRow,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';

const BlankIcon = lucideGlyph(lucideFilePlus, 16);
const TemplateIcon = lucideGlyph(lucideLayoutGrid, 16);

export function NewRuleMenu({
  disabled,
  onBlank,
  onTemplates,
  onDescribe,
}: {
  disabled: boolean;
  onBlank: () => void;
  onTemplates: () => void;
  onDescribe: () => void;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const pick = (go: () => void) => () => {
    setAnchor(null);
    go();
  };
  return (
    <>
      <Button
        variant="primary"
        size="xs"
        aria-haspopup="menu"
        aria-expanded={anchor !== null}
        disabled={disabled}
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        <PlusIcon size={12} />
        New Rule
        <ChevronDownIcon size={12} />
      </Button>
      {anchor ? (
        <PortalMenu anchor={anchor} placement="below" onClose={() => setAnchor(null)}>
          <MenuActionRow plain label="Blank Rule" icon={<BlankIcon />} onClick={pick(onBlank)} />
          <MenuActionRow
            plain
            label="Start From a Template"
            icon={<TemplateIcon />}
            onClick={pick(onTemplates)}
          />
          <MenuActionRow
            plain
            label="Describe a Rule"
            icon={<SparkleIcon size={16} />}
            onClick={pick(onDescribe)}
          />
        </PortalMenu>
      ) : null}
    </>
  );
}
