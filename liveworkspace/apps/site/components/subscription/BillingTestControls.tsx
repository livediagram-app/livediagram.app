'use client';

import { useId, useState } from 'react';
import { lucideWrench } from '@liveworkspace/icons/lucide';
import {
  seatsFor,
  TEAM_SEATS_MAX,
  TEAM_SEATS_MIN,
  type MockPortal,
  type MockPortalAction,
  type MockPortalRequest,
  type SubscriptionState,
} from '@liveworkspace/subscription';
import { Button, lucideGlyph, Spinner, TextInput } from '@liveworkspace/ui';

const TestIcon = lucideGlyph(lucideWrench, 16);

type Control = {
  action: Exclude<MockPortalAction, 'cancel' | 'resume' | 'set_seats'>;
  label: string;
  hint: string;
  /** The states it makes sense in; anywhere else it is disabled. */
  when: readonly SubscriptionState[];
};

// What the payment provider will report once it is wired in, pressed by hand here.
const CONTROLS: readonly Control[] = [
  {
    action: 'fail_payment',
    label: 'Simulate Failed Payment',
    hint: 'A renewal fails, and grace begins.',
    when: ['active'],
  },
  {
    action: 'recover_payment',
    label: 'Simulate Payment Recovered',
    hint: 'The failed renewal goes through.',
    when: ['past_due'],
  },
  {
    action: 'end_grace',
    label: 'End Grace Now',
    hint: 'Grace runs out, and the owner is back on Free.',
    when: ['past_due'],
  },
  {
    action: 'end_period',
    label: 'End Period Now',
    hint: 'The month paid for ends today.',
    when: ['active', 'cancelling'],
  },
  {
    action: 'renew',
    label: 'Renew Now',
    hint: 'A renewal succeeds, for another month. Only within 3 days of the period’s end: months never stack.',
    when: ['active'],
  },
];

/**
 * The Test Controls (subscription.md "Billing": the mock portal's stand-ins for a failed renewal, a recovered
 * payment, grace running out, the period ending and a change of seats). Set apart from the subscriber's own actions
 * by a dashed edge and its own heading, so nobody takes them for part of a real billing page.
 */
export function BillingTestControls({
  portal,
  acting,
  onAct,
}: {
  portal: MockPortal;
  acting: MockPortalRequest['action'] | null;
  onAct: (request: MockPortalRequest) => void;
}) {
  const state = portal.subscription.state;
  return (
    <section
      aria-labelledby="test-controls"
      data-test-controls=""
      className="flex flex-col gap-4 rounded-2xl border-2 border-dashed border-slate-300 p-5 sm:p-6 dark:border-slate-700"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="test-controls"
          className="flex items-center gap-2 text-base font-semibold text-slate-900 dark:text-white"
        >
          <TestIcon aria-hidden />
          Test Controls
        </h2>
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          These stand in for what the payment provider reports on its own. They exist only in Test
          Mode.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {CONTROLS.map((control) => {
          const fits = state !== null && control.when.includes(state);
          return (
            <li
              key={control.action}
              className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
            >
              <Button
                variant="secondary"
                size="md"
                className="min-h-11 w-full"
                disabled={!fits}
                busy={fits && acting !== null}
                onClick={() => onAct({ action: control.action })}
              >
                {acting === control.action ? <Spinner /> : null}
                {control.label}
              </Button>
              <span className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {control.hint}
              </span>
            </li>
          );
        })}
        {portal.members !== null && state !== null && state !== 'ended' ? (
          <SeatsControl
            // A new answer (new seats) starts the field again from it.
            key={portal.subscription.seats}
            seats={portal.subscription.seats}
            busy={acting !== null}
            acting={acting === 'set_seats'}
            onSet={(seats) => onAct({ action: 'set_seats', seats })}
          />
        ) : null}
      </ul>
    </section>
  );
}

function SeatsControl({
  seats,
  busy,
  acting,
  onSet,
}: {
  seats: number;
  busy: boolean;
  acting: boolean;
  onSet: (seats: number) => void;
}) {
  const id = useId();
  const [value, setValue] = useState(String(seats));
  const asked = Number(value);
  // A team holds at most 200 people, so no more seats than that can be set.
  const valid = Number.isInteger(asked) && asked >= 1 && asked <= TEAM_SEATS_MAX;
  // The team is billed for its members, never fewer than the smallest team.
  const billed = valid ? seatsFor(asked) : null;
  return (
    <li className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <form
        className="flex items-end gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          if (valid && !busy) onSet(asked);
        }}
      >
        <label htmlFor={id} className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
            Joined Members
          </span>
          <TextInput
            id={id}
            type="number"
            inputMode="numeric"
            min={1}
            step={1}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </label>
        <Button
          type="submit"
          variant="secondary"
          size="md"
          className="min-h-11"
          disabled={!valid}
          busy={busy}
        >
          {acting ? <Spinner /> : null}
          Set Seats
        </Button>
      </form>
      <span className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {billed !== null && billed !== asked
          ? `Billed as ${billed} seats: never fewer than ${TEAM_SEATS_MIN}.`
          : 'The team’s members change, and its seats follow.'}
      </span>
    </li>
  );
}
