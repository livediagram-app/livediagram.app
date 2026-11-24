'use client';

// Invite by Email, at the top of a team's People tab, for its admins (liveworkspace/docs/specs/004-index/
// one-explorer.md "A team's page"): one or many addresses, typed or pasted, each a chip, a role for them all, and
// Send Invite. Each address is invited on its own (`POST /teams/:id/members`), one after another, so one refusal
// (already invited, the team full) never stops the rest; whatever was refused stays as a chip, with why.

import { forwardRef, useId, useImperativeHandle, useRef, useState } from 'react';
import { Button, Select } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';
import { teamErrorMessage, type TeamRole } from '../../data/teams';
import { CloseIcon } from '../../ui/icons';
import { useToast } from '../../ui/Toasts';
import { useTeams } from '../context';
import { isAddress, MAX_INVITES_AT_ONCE, splitAddresses, tidyAddress } from './people';

export type InviteComposerHandle = { focus: () => void };

type Refusal = { address: string; reason: string };

export const InviteComposer = forwardRef<
  InviteComposerHandle,
  { teamId: string; onInvited: () => void }
>(function InviteComposer({ teamId, onInvited }, ref) {
  const { host } = useTeams();
  const toast = useToast();
  const fieldId = useId();
  const field = useRef<HTMLInputElement>(null);
  const [chips, setChips] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [role, setRole] = useState<TeamRole>('member');
  const [busy, setBusy] = useState(false);
  const [refused, setRefused] = useState<Refusal[]>([]);
  useImperativeHandle(ref, () => ({ focus: () => field.current?.focus() }), []);

  const add = (raw: string) => {
    const words = splitAddresses(raw);
    if (words.length === 0) return;
    setChips((was) => [...was, ...words.filter((w) => !was.includes(w))]);
    setText('');
  };
  const pending = text.trim() ? tidyAddress(text) : null;
  const all = pending && !chips.includes(pending) ? [...chips, pending] : chips;
  const bad = all.filter((a) => !isAddress(a));
  const tooMany = all.length > MAX_INVITES_AT_ONCE;
  const canSend = all.length > 0 && bad.length === 0 && !tooMany;

  async function send() {
    if (!host || !canSend || busy) return;
    setBusy(true);
    setRefused([]);
    const sent: string[] = [];
    const failed: Refusal[] = [];
    for (const address of all) {
      const result = await host.invite(teamId, { email: address, role });
      if (result.ok) sent.push(address);
      else failed.push({ address, reason: teamErrorMessage(result.error) });
    }
    setBusy(false);
    setText('');
    setChips(failed.map((f) => f.address));
    setRefused(failed);
    if (sent.length > 0) {
      toast.show(
        sent.length === 1
          ? `Invitation sent to ${sent[0]}.`
          : `Invitations sent to ${sent.length} people.`,
        { tone: 'success' },
      );
      onInvited();
    }
    field.current?.focus();
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void send();
      }}
      data-team-invite=""
      className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <label
          htmlFor={fieldId}
          className="text-sm font-semibold text-slate-900 dark:text-slate-100"
        >
          Invite by Email
        </label>
        <span className="text-xs text-slate-500 dark:text-slate-400">
          Paste several addresses at once
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        <div
          className="flex min-h-11 min-w-0 flex-[1_1_18rem] cursor-text flex-wrap items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2 py-1.5 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-900"
          onClick={() => field.current?.focus()}
        >
          {chips.map((address) => {
            const ok = isAddress(address);
            return (
              <span
                key={address}
                data-invite-chip={address}
                className={`inline-flex h-7 max-w-full items-center gap-1 rounded-full pl-2.5 pr-1 text-[13px] ${
                  ok
                    ? 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-100'
                    : 'bg-rose-50 text-rose-700 ring-1 ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/30'
                }`}
              >
                <bdi className="truncate">{address}</bdi>
                <button
                  type="button"
                  aria-label={`Remove ${address}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setChips((was) => was.filter((a) => a !== address));
                    field.current?.focus();
                  }}
                  className="relative touch-target inline-flex size-5 shrink-0 items-center justify-center rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-600 dark:hover:text-white"
                >
                  <CloseIcon size={10} />
                </button>
              </span>
            );
          })}
          <input
            ref={field}
            id={fieldId}
            type="text"
            inputMode="email"
            autoComplete="off"
            placeholder={chips.length ? '' : 'name@example.com'}
            value={text}
            aria-invalid={bad.length > 0 || undefined}
            onChange={(e) => {
              const value = e.target.value;
              if (/[,;\s]/.test(value)) add(value);
              else setText(value);
            }}
            onPaste={(e) => {
              const pasted = e.clipboardData.getData('text');
              if (!/[,;\s<]/.test(pasted)) return;
              e.preventDefault();
              add(`${text} ${pasted}`);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && text.trim() && chips.length > 0) {
                e.preventDefault();
                add(text);
              } else if (e.key === 'Backspace' && !text && chips.length > 0) {
                setChips((was) => was.slice(0, -1));
              }
            }}
            onBlur={() => {
              if (text.trim()) add(text);
            }}
            className="h-8 min-w-32 flex-1 border-0 bg-transparent px-1 text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
          />
        </div>
        <Select
          aria-label="Role for the invitation"
          value={role}
          onChange={(e) => setRole(e.target.value as TeamRole)}
          className="shrink-0 self-stretch"
          selectClassName="h-full min-h-11 text-sm"
        >
          <option value="member">Member</option>
          <option value="admin">Admin</option>
        </Select>
        {/* Busy, it stays enabled so the keyboard stays on it; a second press does nothing (send() checks). */}
        <Button
          type="submit"
          size="md"
          className="min-h-11"
          disabled={!canSend && !busy}
          busy={busy}
        >
          {busy ? 'Sending…' : all.length > 1 ? `Send ${all.length} Invites` : 'Send Invite'}
        </Button>
      </div>
      {bad.length > 0 ? (
        <p role="alert" className="m-0 text-xs text-rose-700 dark:text-rose-300">
          {bad.length === 1
            ? `${bad[0]} isn’t an email address.`
            : `${bad.length} of these aren’t email addresses.`}{' '}
          Remove {bad.length === 1 ? 'it' : 'them'} to send.
        </p>
      ) : tooMany ? (
        <p role="alert" className="m-0 text-xs text-rose-700 dark:text-rose-300">
          Up to {MAX_INVITES_AT_ONCE} addresses at once. Send these, then the rest.
        </p>
      ) : null}
      {refused.length > 0 ? (
        <Callout tone="error" role="alert">
          {refused.length === 1
            ? `${refused[0]!.address}: ${refused[0]!.reason}`
            : `${refused.length} weren’t sent: ${refused.map((r) => `${r.address} (${r.reason})`).join(', ')}`}
        </Callout>
      ) : null}
    </form>
  );
});
