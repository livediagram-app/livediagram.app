// The Wrangler environment choice (docs/specs/020-import-export/infrastructure-import.md "The editor"): shown only
// when a wrangler.toml read holds [env.*] tables, "Top level" first. It applies to each file that has it; the others
// draw their top level, which the report says.

import { useId } from 'react';
import { Select } from '@livediagram/ui';

export function InfraEnvSelect({
  envs,
  value,
  onChange,
  disabled,
}: {
  envs: readonly string[];
  // '' is the top level.
  value: string;
  onChange: (env: string) => void;
  disabled: boolean;
}) {
  const id = useId();
  if (envs.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
      <label htmlFor={id} className="text-xs font-medium text-slate-700 dark:text-slate-200">
        Wrangler environment
      </label>
      <Select
        id={id}
        size="md"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="min-w-[10rem]"
      >
        <option value="">Top level</option>
        {envs.map((env) => (
          <option key={env} value={env}>
            {env}
          </option>
        ))}
      </Select>
    </div>
  );
}
