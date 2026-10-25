'use client';

import { useId, useState, type CSSProperties } from 'react';
import { lucideAppWindow, lucideCloud } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '../icons/lucide-glyph';
import { Switch } from '../Switch';
import { saveSwitchAnnouncement, saveSwitchCopy, type SaveSwitchMove } from './save-switch';

const CloudGlyph = lucideGlyph(lucideCloud, 16);
const BrowserGlyph = lucideGlyph(lucideAppWindow, 16);

// A panel painted in its own colours (a start panel in its tab's theme) hands them in; without, the row wears the
// app's light or dark look.
export type SaveSwitchInk = {
  text: string;
  muted: string;
  accent: string;
  // The quiet surface the icon sits on.
  surface: string;
};

/**
 * The switch's state while it moves an item (each product's save-locations.md, "On the start screen"). `checked` is
 * where the item is, or where it is going once flipped; a move holds the switch busy and says so politely; a failure
 * hands the error to the app (its toast) and the switch returns to where the item still is. After a move the switch
 * stays on its new side until the app's own `onServer` catches up, so it never flickers back.
 */
export function useSaveSwitch({
  onServer,
  toServer,
  toBrowser,
  onFailure,
}: {
  onServer: boolean;
  toServer: () => Promise<void>;
  toBrowser: () => Promise<void>;
  onFailure: (move: SaveSwitchMove, error: unknown) => void;
}) {
  const [moving, setMoving] = useState<SaveSwitchMove | null>(null);
  // Where the switch shows while a move runs and until `onServer` follows it.
  const [heading, setHeading] = useState<boolean | null>(null);
  const [announcement, setAnnouncement] = useState('');
  if (heading !== null && moving === null && heading === onServer) setHeading(null);
  const checked = heading ?? onServer;
  const flip = async (next: boolean) => {
    if (moving !== null || next === checked) return;
    const move: SaveSwitchMove = next ? 'server' : 'browser';
    setMoving(move);
    setHeading(next);
    setAnnouncement(saveSwitchAnnouncement(move, false));
    try {
      await (next ? toServer() : toBrowser());
      setAnnouncement(saveSwitchAnnouncement(move, true));
    } catch (error) {
      setHeading(null);
      setAnnouncement('');
      onFailure(move, error);
    } finally {
      setMoving(null);
    }
  };
  return { checked, moving, announcement, flip };
}

/**
 * "Sync <Kind> to Server": a quiet row under a start screen's choices. An icon that says where the item lives (a
 * cloud or a browser window), the label, one line of helper text that follows the state, and the switch. The label
 * names the switch and flips it when clicked; the helper line describes it.
 */
export function SaveSwitchRow({
  kind,
  signedIn,
  checked,
  moving = null,
  announcement = '',
  onChange,
  ink,
  className = '',
}: {
  kind: string;
  signedIn: boolean;
  checked: boolean;
  moving?: SaveSwitchMove | null;
  announcement?: string;
  onChange: (next: boolean) => void;
  ink?: SaveSwitchInk;
  // The caller's spacing only.
  className?: string;
}) {
  const id = useId();
  const switchId = `${id}-switch`;
  const labelId = `${id}-label`;
  const helperId = `${id}-helper`;
  // The words follow where it is going: a move in flight already reads as its destination.
  const copy = saveSwitchCopy({ kind, onServer: checked, signedIn, moving });
  const Icon = checked ? CloudGlyph : BrowserGlyph;
  return (
    <div data-save-switch="" className={`flex min-w-0 items-center gap-3 ${className}`}>
      <span
        aria-hidden
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors duration-short motion-reduce:transition-none ${
          ink
            ? ''
            : checked
              ? 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300'
              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
        }`}
        style={
          ink
            ? ({
                backgroundColor: ink.surface,
                color: checked ? ink.accent : ink.muted,
              } as CSSProperties)
            : undefined
        }
      >
        <Icon />
      </span>
      <div className="min-w-0 flex-1">
        <label
          id={labelId}
          htmlFor={switchId}
          className={`block cursor-pointer text-[13px] font-medium leading-snug ${
            ink ? '' : 'text-slate-800 dark:text-slate-100'
          }`}
          style={ink ? { color: ink.text } : undefined}
        >
          {copy.label}
        </label>
        <p
          id={helperId}
          className={`text-[12px] leading-snug ${ink ? '' : 'text-slate-500 dark:text-slate-400'}`}
          style={ink ? { color: ink.muted } : undefined}
        >
          {copy.helper}
        </p>
      </div>
      <Switch
        id={switchId}
        checked={checked}
        busy={moving !== null}
        labelledBy={labelId}
        describedBy={helperId}
        onChange={onChange}
        onColor={ink?.accent}
        offColor={ink ? `color-mix(in srgb, ${ink.muted} 45%, transparent)` : undefined}
        className="-mr-1.5"
      />
      {/* Polite: what a move is doing, then that it landed. A failure says so in the app's toast. */}
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}

/**
 * The row and its moves together, for an open item's start screen. `shown` is the app's `showsSaveSwitch` answer;
 * once a move has started the row stays until it lands, whatever that answer does meanwhile.
 */
export function SaveSwitch({
  shown,
  kind,
  signedIn,
  onServer,
  toServer,
  toBrowser,
  onFailure,
  ink,
  className,
}: {
  shown: boolean;
  kind: string;
  signedIn: boolean;
  onServer: boolean;
  toServer: () => Promise<void>;
  toBrowser: () => Promise<void>;
  onFailure: (move: SaveSwitchMove, error: unknown) => void;
  ink?: SaveSwitchInk;
  className?: string;
}) {
  const state = useSaveSwitch({ onServer, toServer, toBrowser, onFailure });
  if (!shown && state.moving === null) return null;
  return (
    <SaveSwitchRow
      kind={kind}
      signedIn={signedIn}
      checked={state.checked}
      moving={state.moving}
      announcement={state.announcement}
      onChange={(next) => void state.flip(next)}
      ink={ink}
      className={className}
    />
  );
}
