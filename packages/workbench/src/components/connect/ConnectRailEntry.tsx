'use client';

// Connect File in a start screen's sidebar (liveworkspace/docs/specs/004-index/connected-tabs.md
// "Connecting"): the rail's foot entry, pinned to the very bottom of the rail under a hairline, apart from the
// categories (it brings a file from another app, not a way to start this one). On a phone, where the rail is a row of
// chips, it is one more chip. Drawn like a rail row, in the start panel's own colours, on one line: every app's logo
// fanned where a row's icon goes, to say where the files come from (the host's too: its other files connect as well),
// then its name. An app's own foot entries (`children`, liveplanner's Import) follow it in the same group.
import type { ReactNode } from 'react';
import { BrandMark } from '@liveworkspace/brand';
import type { App } from '@liveworkspace/index-client';
import { RailFoot, RailFootButton, type RailFootColours } from '../start/RailFoot';

// Every app's logo in the row's icon slot, in the same order in every app.
const FAN: readonly App[] = [
  'livediagram',
  'liveplanner',
  'livedocuments',
  'livedesign',
  'livehuddle',
];

export const CONNECT_RAIL_ID = 'connect';
// The entry's name, the owner's words (Work Tracker #569): short enough for one line in a 240px rail.
export const CONNECT_RAIL_NAME = 'Connect File';

export type ConnectRailColours = RailFootColours;

export function ConnectRailEntry({
  on,
  onPick,
  colours,
  children,
}: {
  on: boolean;
  onPick: () => void;
  colours: ConnectRailColours;
  // The app's own entries below Connect File, in the same foot group.
  children?: ReactNode;
}) {
  return (
    <RailFoot colours={colours}>
      <RailFootButton
        railId={CONNECT_RAIL_ID}
        on={on}
        onPick={onPick}
        colours={colours}
        name={CONNECT_RAIL_NAME}
        icon={
          // The logos stand where a row's icon goes as one stacked cluster, like a row of avatars: each on a disc of
          // the panel's paper edged with its hairline, tucked 40% under the one before it, with a paper ring cutting a
          // clean gap where they meet.
          <span aria-hidden className="flex shrink-0 items-center">
            {FAN.map((app, i) => (
              <span
                key={app}
                className={`flex size-5 items-center justify-center rounded-full ${i === 0 ? '' : '-ml-2'}`}
                style={{
                  backgroundColor: colours.card,
                  boxShadow: `0 0 0 2px ${colours.card}, inset 0 0 0 1px ${colours.border}`,
                  zIndex: FAN.length - i,
                }}
              >
                <BrandMark app={app} className="size-3.5" />
              </span>
            ))}
          </span>
        }
      />
      {children}
    </RailFoot>
  );
}
