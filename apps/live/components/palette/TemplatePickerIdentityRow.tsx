import { initialsOf, randomName, type Participant } from '@/lib/identity';
import { Tooltip } from '@/components/primitives/Tooltip';
import { RefreshIcon } from './template-picker-icons';

// The picker's identity row (spec/14 welcome + join flows): the avatar
// bubble, the display-name input (read-only when the name is dictated
// by the visitor's Clerk account), and the shuffle-a-random-name
// button. Split out of TemplatePicker; the host keeps the name state
// (its follow-the-participant effect writes it) and passes it through.
export function TemplatePickerIdentityRow({
  participant,
  name,
  effectiveName,
  nameLocked,
  onChangeName,
}: {
  participant: Participant;
  name: string;
  effectiveName: string;
  nameLocked: boolean;
  onChangeName: (next: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50/50 p-3 dark:border-slate-700 dark:bg-slate-800/50">
      <div
        role="img"
        aria-label={`Your avatar colour: ${participant.color}`}
        style={{ backgroundColor: participant.color }}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white"
      >
        {initialsOf(effectiveName)}
      </div>
      <div className="flex-1">
        <label
          htmlFor="welcome-name"
          className="block text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400"
        >
          Your name
        </label>
        <input
          id="welcome-name"
          value={name}
          onChange={(e) => onChangeName(e.target.value)}
          placeholder={participant.name}
          readOnly={nameLocked}
          aria-readonly={nameLocked}
          // Locked: the value comes from Clerk; greying it out
          // + removing focus affordance makes it visually
          // obvious it isn't editable, but the input stays
          // present so the name is still visible.
          className={
            nameLocked
              ? 'mt-0.5 w-full cursor-default bg-transparent text-sm text-slate-500 outline-none dark:text-slate-400'
              : 'mt-0.5 w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400 dark:text-slate-100 dark:placeholder:text-slate-500'
          }
        />
      </div>
      {nameLocked ? null : (
        <Tooltip title="Shuffle name" description="Pick a different random name.">
          <button
            type="button"
            onClick={() => onChangeName(randomName())}
            aria-label="Generate a different name"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <RefreshIcon />
          </button>
        </Tooltip>
      )}
    </div>
  );
}
