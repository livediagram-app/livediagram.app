'use client';

// The Resources dialog (each product's docs/specs/008-canvas/element-menu-quick-bar.md "Resources"): what attaches
// to an element, opened by the element menu's Resources row. A centred card, a bottom sheet on a phone, of one
// steady height under the dialog hero header. Its first screen shows each option as a tile (its glyph on a plate,
// its name, what the element has now or a line saying what it is, and the verb the tile runs). An option with
// options of its own opens a screen of them inside the dialog, under a back bar that leads back to the list; an
// option of those with a step of its own (a link's place: a web address, a tab, a file) opens that step inside the
// dialog too, under a back bar that leads back to the options. Only what has no step here (the note's own panel, the
// comment thread, Assign Action) opens another surface, the dialog closing first.
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  BackBar,
  Glyph,
  closeDialogSlot,
  openDialogSlot,
  setDialogSlotNode,
  useDialogSlot,
} from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { resourcesHeroArt } from '@liveworkspace/ui/dialog-hero-art/resources';
import type { ResourceChoice, ResourceOption } from '../palette/element-resources';
import { Dialog } from './Dialog';

const FOCUS =
  'outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-brand-400 dark:focus-visible:ring-offset-slate-900';
// An option on the first screen: a tile, lifted a little under the pointer. One the element already has is tinted.
const TILE = `group relative flex min-h-[9.5rem] w-full cursor-pointer flex-col items-center rounded-2xl border p-4 text-center transition-[border-color,background-color,box-shadow,transform] duration-micro hover:-translate-y-px hover:shadow-md motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${FOCUS}`;
const TILE_OFF =
  'border-slate-200 bg-white hover:border-brand-300 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/60';
const TILE_ON =
  'border-brand-200 bg-brand-50/60 hover:border-brand-300 dark:border-brand-500/40 dark:bg-brand-500/10 dark:hover:border-brand-400/60';
const PLATE =
  'flex shrink-0 items-center justify-center transition-colors duration-micro motion-reduce:transition-none';
const PLATE_OFF =
  'bg-slate-100 text-slate-600 group-hover:bg-brand-100 group-hover:text-brand-700 dark:bg-slate-800 dark:text-slate-300 dark:group-hover:bg-brand-500/20 dark:group-hover:text-brand-200';
const PLATE_ON = 'bg-brand-700 text-white shadow-sm dark:bg-brand-600';
const BADGE =
  'shrink-0 rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700 dark:bg-brand-500/20 dark:text-brand-200';
// One of an option's own options: a row card with its glyph, its name, a line, and a chevron or what it is now.
const CHOICE = `group flex w-full cursor-pointer items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-3.5 text-left transition-[border-color,background-color,box-shadow] duration-micro hover:border-brand-300 hover:bg-brand-50/40 hover:shadow-sm motion-reduce:transition-none dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/60 dark:hover:bg-slate-800/70 ${FOCUS}`;
// The quiet row that takes the resource off, set apart at the screen's foot.
const REMOVE = `group flex cursor-pointer items-center gap-2 self-start rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-slate-600 transition-colors duration-micro hover:bg-slate-100 hover:text-slate-900 motion-reduce:transition-none dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-50 [&_svg]:size-4 ${FOCUS}`;

// Up, Down, Home and End move between a screen's rows, as they do in the menu the dialog opened from.
function moveBetweenRows(e: KeyboardEvent<HTMLElement>) {
  const to = { ArrowDown: 1, ArrowUp: -1, Home: -Infinity, End: Infinity }[e.key];
  if (to === undefined) return;
  const rows = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button[data-row]')];
  if (!rows.length) return;
  const at = rows.indexOf(document.activeElement as HTMLButtonElement);
  e.preventDefault();
  rows[Math.max(0, Math.min(rows.length - 1, at < 0 && to === 1 ? 0 : at + to))]?.focus();
}

export function ResourcesDialog({
  elementName,
  options,
  onClose,
}: {
  // What the element is, as its menu names it ("Square"), so the dialog says what these are attached to.
  elementName: string;
  options: readonly ResourceOption[];
  onClose: () => void;
}) {
  const titleId = useId();
  // The option whose screen is open, by key; null is the list. Read through the live options, so an option that
  // leaves (or loses its own options, as a note does once removed) falls back to the list.
  const [screen, setScreen] = useState<string | null>(null);
  // The option's own option whose step is open, by key; null is the option's screen.
  const [step, setStep] = useState<string | null>(null);
  const open = options.find((o) => o.key === screen && o.choices?.length) ?? null;
  const stepped = open?.choices?.find((c) => c.key === step && c.panel) ?? null;
  // An option whose own surface is a dialog (Assign an Action) draws inside this one, as a screen of it: the dialog
  // slot it opens is claimed by that dialog, which then renders here instead of over us (dialog-slot.ts).
  const [asked, setAsked] = useState<{ key: string; seq: number } | null>(null);
  const slot = useDialogSlot();
  // Hosting lasts while the slot it opened is still there and its dialog has not closed itself (saved, cancelled):
  // read from the slot, so the list comes back by itself.
  const hosted = asked && slot?.seq === asked.seq && !slot.released ? asked : null;
  const hostedOption = hosted ? (options.find((o) => o.key === hosted.key) ?? null) : null;
  const askedSeq = asked?.seq ?? null;
  const released = askedSeq !== null && slot?.seq === askedSeq && slot.released;
  // Its dialog let go: the slot is done with. And closed with a dialog still inside: the slot goes with us.
  useEffect(() => {
    if (released && askedSeq !== null) closeDialogSlot(askedSeq);
  }, [released, askedSeq]);
  useEffect(
    () => () => {
      if (askedSeq !== null) closeDialogSlot(askedSeq);
    },
    [askedSeq],
  );
  const host = (o: ResourceOption) => {
    const seq = openDialogSlot();
    setAsked({ key: o.key, seq });
    o.run();
  };
  const leaveHosted = () => {
    if (!hosted) return;
    // The dialog's own way out (it may ask about unsaved work); with none yet, the slot alone.
    if (slot?.claimed) return slot.claimed.close();
    closeDialogSlot(hosted.seq);
  };
  // Where the hosted dialog draws: one callback per slot, so React hands the node over once.
  const hostedSeq = hosted?.seq ?? null;
  const slotNode = useCallback(
    (node: HTMLDivElement | null) => {
      if (hostedSeq !== null) setDialogSlotNode(hostedSeq, node);
    },
    [hostedSeq],
  );
  const body = useRef<HTMLDivElement>(null);
  // Where focus goes after a move between screens: the back bar going in, the row left coming back.
  // Unset until the first move, so opening the dialog leaves focus where the shell puts it.
  const focusNext = useRef<string | null>(null);
  const at = `${open?.key ?? ''}/${stepped?.key ?? ''}`;
  useEffect(() => {
    const target = focusNext.current;
    if (target === null) return;
    focusNext.current = null;
    body.current?.querySelector<HTMLElement>(target)?.focus();
  }, [at]);

  const enter = (o: ResourceOption) => {
    focusNext.current = 'button';
    setStep(null);
    setScreen(o.key);
  };
  const back = () => {
    if (open) focusNext.current = `[data-option="${open.key}"]`;
    setStep(null);
    setScreen(null);
  };
  // A step is done (a link saved): back to the list, which now shows it. It touches no ref, as it is handed to
  // the step while rendering.
  const done = useCallback(() => {
    setStep(null);
    setScreen(null);
  }, []);
  const backToOption = () => {
    if (stepped) focusNext.current = `[data-choice="${stepped.key}"]`;
    setStep(null);
  };
  // Opens another surface (a panel, a popover, another dialog): the dialog closes first, so the two never stack.
  const leaveFor = (run: () => void) => {
    onClose();
    run();
  };
  const choose = (c: ResourceChoice) => {
    if (c.panel) {
      focusNext.current = 'button';
      return setStep(c.key);
    }
    if (!c.removes) return leaveFor(c.run);
    // The resource goes and the dialog stays: back to the list, where its tile now reads as empty.
    c.run();
    back();
  };

  return (
    <Dialog
      open
      onClose={onClose}
      titleId={titleId}
      size="md"
      phoneSheet
      // One height for the list and an option's screens, so the card never jumps between them. A whole form drawn
      // inside (Assign an Action) gets the room it needs instead of a scrollbar.
      className={hostedOption ? 'min-h-[35rem] max-h-[92vh]' : 'h-[35rem] max-h-[90vh]'}
    >
      <HeroDialogHeader
        art={resourcesHeroArt}
        titleId={titleId}
        title="Resources"
        subtitle={`What is attached to this ${elementName}.`}
        onClose={onClose}
        underHandle
      />
      <div
        ref={body}
        data-resources-screen={
          hostedOption
            ? `${hostedOption.key}/dialog`
            : stepped
              ? `${open!.key}/${stepped.key}`
              : open
                ? open.key
                : 'list'
        }
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-6 sm:py-5"
      >
        {hosted && hostedOption ? (
          <div className="flex min-h-0 flex-1 flex-col motion-safe:animate-fade-in">
            <BackBar label="Resources" current={hostedOption.name} onClick={leaveHosted} />
            {/* Where the option's own dialog draws. It bleeds to the panel's edges, as its sections bring their own
                side padding. */}
            <div
              ref={slotNode}
              data-resource-dialog={hostedOption.key}
              // Its sections carry 16px sides of their own, so it steps out by exactly that: its fields line up
              // with the back bar. Its slim header row (a lone help link here) is left out, and its footer is a
              // dialog's: the buttons side by side at the right, not Tools' stacked full-width pair.
              className="-mx-4 -mb-4 flex min-h-0 flex-1 flex-col overflow-y-auto sm:-mb-5 [&_[data-dialog-inline-header]]:hidden [&_[data-tool-footer]]:flex-row [&_[data-tool-footer]]:justify-end [&_[data-tool-footer]]:gap-2 [&_[data-tool-footer]]:px-4 [&_[data-tool-footer]]:py-3 [&_[data-tool-footer]>*]:w-auto!"
            />
          </div>
        ) : open && stepped ? (
          <div
            key={`${open.key}/${stepped.key}`}
            className="flex min-h-0 flex-1 flex-col motion-safe:animate-fade-in"
          >
            <BackBar
              label={open.name}
              current={stepped.crumb ?? stepped.label}
              onClick={backToOption}
            />
            {/* The step says when it is done (a link saved, a tab picked): back to the list, which now shows it. */}
            {stepped.panel!(done)}
          </div>
        ) : open ? (
          <OptionScreen key={open.key} option={open} onBack={back} onChoose={choose} />
        ) : (
          <OptionList
            options={options}
            elementName={elementName}
            onPick={(o) => (o.choices?.length ? enter(o) : o.inline ? host(o) : leaveFor(o.run))}
          />
        )}
      </div>
    </Dialog>
  );
}

// The first screen: each option a tile, two across (one on a phone).
function OptionList({
  options,
  elementName,
  onPick,
}: {
  options: readonly ResourceOption[];
  elementName: string;
  onPick: (o: ResourceOption) => void;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 motion-safe:animate-fade-in">
      {/* What Resources are, over the options. */}
      <Callout tone="info">
        Attach an action, comments, a link or a note to this {elementName}.
      </Callout>
      <div
        role="group"
        aria-label="Resources"
        data-element-resources=""
        onKeyDown={moveBetweenRows}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        {options.map((o) => {
          const drills = !!o.choices?.length;
          return (
            <button
              key={o.key}
              type="button"
              data-row=""
              data-option={o.key}
              data-resource-drills={drills ? '' : undefined}
              className={`${TILE} ${o.on ? TILE_ON : TILE_OFF}`}
              onClick={() => onPick(o)}
            >
              {o.on ? (
                <span data-resource-on="" className={`${BADGE} absolute right-3 top-3`}>
                  Added
                </span>
              ) : null}
              <span
                aria-hidden
                className={`${PLATE} size-11 rounded-xl [&_svg]:size-5 ${o.on ? PLATE_ON : PLATE_OFF}`}
              >
                {o.icon}
              </span>
              <span className="mt-3 text-[15px] font-semibold leading-5 text-slate-900 dark:text-slate-50">
                {o.name}
              </span>
              {/* What it has now, once it has one; until then, what it is. */}
              <span
                data-resource-state=""
                className={`mt-0.5 line-clamp-2 break-words text-[13px] leading-[18px] ${
                  o.on ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {o.on ? o.state : o.detail}
              </span>
              <span
                data-resource-verb=""
                className="mt-auto flex items-center justify-center gap-1 pt-3 text-[13px] font-semibold text-brand-700 dark:text-brand-300"
              >
                {o.label}
                <span
                  aria-hidden
                  className="transition-transform duration-micro group-hover:translate-x-0.5 motion-reduce:transition-none"
                >
                  <ChevronGlyph />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// An option's own screen: the way back, what the element has now (once it has one), then its options.
function OptionScreen({
  option,
  onBack,
  onChoose,
}: {
  option: ResourceOption;
  onBack: () => void;
  onChoose: (c: ResourceChoice) => void;
}) {
  const choices = option.choices ?? [];
  const keeps = choices.filter((c) => !c.removes);
  const removes = choices.filter((c) => c.removes);
  const many = keeps.length > 4;
  return (
    <div className="flex min-h-0 flex-1 flex-col motion-safe:animate-fade-in">
      <BackBar label="Resources" current={option.name} onClick={onBack} />
      {option.on ? (
        <div
          data-resource-summary=""
          className="mb-3 flex items-start gap-3 rounded-xl bg-brand-50/70 p-3.5 dark:bg-brand-500/10"
        >
          <span aria-hidden className={`${PLATE} ${PLATE_ON} size-9 rounded-[10px] [&_svg]:size-4`}>
            {option.icon}
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-brand-700 dark:text-brand-300">
              Now
            </span>
            <span className="line-clamp-4 whitespace-pre-line break-words text-sm font-medium leading-5 text-slate-900 dark:text-slate-50">
              {option.preview ?? option.state}
            </span>
          </span>
        </div>
      ) : (
        <p className="mb-3 px-0.5 text-sm text-slate-600 dark:text-slate-300">{option.detail}.</p>
      )}
      <div
        role="group"
        aria-label={`${option.name} options`}
        data-resource-choices={option.key}
        onKeyDown={moveBetweenRows}
        className="flex min-h-0 flex-1 flex-col gap-2"
      >
        {/* Many options (a link's places: a web address, a tab, a file of each product) sit two across, so the
            screen never scrolls for them. */}
        <div className={many ? 'grid grid-cols-1 gap-2 sm:grid-cols-2' : 'flex flex-col gap-2'}>
          {keeps.map((c) => (
            <button
              key={c.key}
              type="button"
              data-row=""
              data-choice={c.key}
              aria-current={c.current ? 'true' : undefined}
              className={`${CHOICE} ${many ? 'gap-3! p-3!' : ''}`}
              onClick={() => onChoose(c)}
            >
              <span
                aria-hidden
                className={`${PLATE} size-10 rounded-[11px] [&_svg]:size-[18px] ${c.current ? PLATE_ON : PLATE_OFF}`}
              >
                {c.icon}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold leading-5 text-slate-900 dark:text-slate-50">
                  {c.title ?? c.label}
                </span>
                <span className="truncate text-[13px] leading-[18px] text-slate-500 dark:text-slate-400">
                  {c.detail}
                </span>
              </span>
              {c.current ? (
                <span data-choice-current="" className={BADGE}>
                  Current
                </span>
              ) : null}
              {many ? null : (
                <span
                  aria-hidden
                  className="shrink-0 text-slate-400 transition-[color,transform] duration-micro group-hover:translate-x-0.5 group-hover:text-brand-600 motion-reduce:transition-none dark:group-hover:text-brand-300"
                >
                  <ChevronGlyph />
                </span>
              )}
            </button>
          ))}
        </div>
        {removes.length ? (
          <div className="mt-auto flex flex-col gap-1 pt-2">
            {removes.map((c) => (
              <button
                key={c.key}
                type="button"
                data-row=""
                data-choice={c.key}
                className={REMOVE}
                onClick={() => onChoose(c)}
              >
                <span aria-hidden className="text-slate-400 group-hover:text-slate-600">
                  {c.icon}
                </span>
                {c.label}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ChevronGlyph() {
  return (
    <Glyph size={14} units={12}>
      <path d="M4.5 2.5 8 6 4.5 9.5" />
    </Glyph>
  );
}
