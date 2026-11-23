'use client';

// The screen's New Rule (liveplanner/docs/specs/026-plan/automations.md "The Automations screen", "Describe a Rule"): a menu of a
// Blank Rule, built step by step, Start From a Template, which opens the Templates tab, and Describe a Rule, which
// drafts one from words with AI. Disabled while the list loads and once the item holds every rule it may (the list's
// `rulesMax`), saying why with Pro on.

import { ToolFooterButton } from '@liveworkspace/ui';
import { useState } from 'react';
import {
  Button,
  ChevronDownIcon,
  PlusIcon,
  SparkleIcon,
  Tooltip,
  lucideGlyph,
} from '@liveworkspace/ui';
import { lucideFilePlus, lucideLayoutGrid } from '@liveworkspace/icons/lucide';
import {
  MenuActionRow,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';

const BlankIcon = lucideGlyph(lucideFilePlus, 16);
const TemplateIcon = lucideGlyph(lucideLayoutGrid, 16);

export function NewRuleMenu({
  disabled,
  offReason,
  onBlank,
  onTemplates,
  onDescribe,
  footer = false,
}: {
  disabled: boolean;
  // Why it is off, as its tooltip (the item holds every rule its owner's tier allows), with Pro on.
  offReason?: string | undefined;
  onBlank: () => void;
  onTemplates: () => void;
  onDescribe: () => void;
  // Inside Tools: the tools' full-width footer button, its menu opening upward (owner, 2026-11-17).
  footer?: boolean;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const pick = (go: () => void) => () => {
    setAnchor(null);
    go();
  };
  const trigger = footer ? (
    <ToolFooterButton
      aria-haspopup="menu"
      aria-expanded={anchor !== null}
      disabled={disabled}
      onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
    >
      <PlusIcon size={12} />
      New Rule
      <ChevronDownIcon size={12} />
    </ToolFooterButton>
  ) : (
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
  );
  return (
    <>
      {disabled && offReason ? <Tooltip label={offReason}>{trigger}</Tooltip> : trigger}
      {anchor ? (
        <PortalMenu
          anchor={anchor}
          placement={footer ? 'above-start' : 'below'}
          onClose={() => setAnchor(null)}
        >
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
