'use client';

import { useState } from 'react';
import { SETTINGS_ROW_BUTTON, SettingsRowShell } from '@liveworkspace/settings-ui';
import { RetiredPartsDialog } from '@/components/dialogs/RetiredPartsDialog';
import { useAccountBootstrap } from '@/hooks/persistence/useAccountBootstrap';
import { useRetiredPartsMove } from '@/hooks/persistence/useRetiredPartsMove';
import { useSettledOwnerId } from '@/hooks/persistence/useSettledOwnerId';
import type { SettingsRetiredPartsRowSpec } from './settings-catalogue';

// The way back to the offer to move retired parts (docs/specs/006-document/offline-mode.md "Moving retired parts
// to the other apps"): the same dialog as on load, opened by hand, so Not Now here only closes it. The row stays
// while Settings is open (its count is read when Settings opens), so once everything has moved it says so.
export function SettingsRetiredPartsRow({ row }: { row: SettingsRetiredPartsRowSpec }) {
  const { authLoaded, accountUserId } = useAccountBootstrap();
  const ownerId = useSettledOwnerId(authLoaded, accountUserId);
  const move = useRetiredPartsMove(ownerId);
  const [allMoved, setAllMoved] = useState(false);
  return (
    <>
      <SettingsRowShell
        row={row}
        control={
          <button
            type="button"
            onClick={() => void move.offer().then((offered) => setAllMoved(!offered))}
            // The move is made as the person: there is no one to make it as until the page knows who that is.
            disabled={!ownerId || allMoved}
            aria-describedby={`${row.key}-description`}
            className={SETTINGS_ROW_BUTTON}
          >
            {allMoved ? 'All Moved' : 'Move Them'}
          </button>
        }
      />
      <RetiredPartsDialog
        phase={move.phase}
        onMove={() => void move.move()}
        onNotNow={move.notNow}
        onClose={move.close}
      />
    </>
  );
}
