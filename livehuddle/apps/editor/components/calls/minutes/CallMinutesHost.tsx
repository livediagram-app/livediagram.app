'use client';

// Call Minutes on the Call dock (docs/specs/012-collaboration/call-minutes.md "What people see"): the one-time
// notice that the owner's month is running low, above the dock, and the dialog that says the month is used. Both
// draw the subscription kit's parts, so they load only when there is something to say, never with the dock; with Pro
// off, or while the server has said nothing about minutes, this draws nothing at all.
import dynamic from 'next/dynamic';
import { proOn } from '@liveworkspace/subscription-ui/flag';
import { setCallMinutesNotice, useCallMinutes } from '@/lib/calls/call-minutes-store';

const CallMinutesLow = dynamic(() => import('./CallMinutesLow').then((m) => m.CallMinutesLow), {
  ssr: false,
});
const CallMinutesUsedDialog = dynamic(
  () => import('./CallMinutesUsedDialog').then((m) => m.CallMinutesUsedDialog),
  { ssr: false },
);

export function CallMinutesHost() {
  const minutes = useCallMinutes();
  if (!proOn() || !minutes.metered) return null;
  return (
    <>
      {/* Running low is the owner's to act on: someone the server named no owner to is shown nothing. */}
      {minutes.low && minutes.used === null && minutes.owner !== null ? (
        <CallMinutesLow owner={minutes.owner} caller={minutes.caller} />
      ) : null}
      {minutes.used !== null && minutes.notice ? (
        <CallMinutesUsedDialog
          owner={minutes.owner}
          guest={minutes.guest}
          caller={minutes.caller}
          used={minutes.used.used}
          limit={minutes.used.limit}
          onClose={() => setCallMinutesNotice(false)}
        />
      ) : null}
    </>
  );
}
