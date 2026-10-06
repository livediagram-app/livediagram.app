'use client';

// The canvas chrome's side of Edit Cards (./card-types-opener.ts): while the Card Types button is on
// screen, opening means pressing its popover open (never toggling an open one shut).
import { useEffect, useRef } from 'react';
import { useLatest } from '@/hooks/ui/useLatest';
import type { DockPanel } from '@/hooks/canvas/useDockPopovers';
import { registerCardTypesOpener } from './card-types-opener';

export function useCardTypesOpener(
  active: boolean,
  dock: {
    activeDockPanel: DockPanel | null;
    handleDockButtonClick: (id: DockPanel, button: HTMLElement, above?: boolean) => void;
  },
) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const latest = useLatest(dock);
  useEffect(() => {
    if (!active) return;
    return registerCardTypesOpener(() => {
      const button = buttonRef.current;
      const { activeDockPanel, handleDockButtonClick } = latest.current;
      if (button && activeDockPanel !== 'card-types')
        handleDockButtonClick('card-types', button, true);
    });
  }, [active, latest]);
  return buttonRef;
}
