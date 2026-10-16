// The benchmark's report, from a scored round: how each model did, how each task did, and what keeps failing.
// Pure: results in, Markdown out. "Recurring" means two or more runs, the bar a finding needs before it earns a fix.

export const RECURRING = 2;

const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g;

// An error message with what differs between runs (ids, quoted text, an id in brackets, numbers) taken out, so the
// same fault groups.
export function normaliseError(message) {
  return (message ?? '')
    .replace(UUID, '<id>')
    .replace(/"[^"]*"/g, '"…"')
    .replace(/\([^()]*\)/g, '(…)')
    .replace(/\d+/g, 'N')
    .trim();
}

function median(values) {
  const v = values.filter((x) => typeof x === 'number').sort((a, b) => a - b);
  if (v.length === 0) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

const pct = (n, d) => (d ? `${Math.round((100 * n) / d)}%` : 'n/a');
const fixed = (x, digits = 1) => (x === null || x === undefined ? 'n/a' : x.toFixed(digits));

export function passFraction(run) {
  if (run.checks.length === 0) return null;
  return run.checks.filter((c) => c.pass).length / run.checks.length;
}

function groupBy(items, key) {
  const out = new Map();
  for (const item of items) {
    const k = key(item);
    if (!out.has(k)) out.set(k, []);
    out.get(k).push(item);
  }
  return out;
}

export function modelRows(runs) {
  return [...groupBy(runs, (r) => r.model)].map(([model, rs]) => {
    const checks = rs.flatMap((r) => r.checks);
    return {
      model,
      runs: rs.length,
      checksPassed: checks.filter((c) => c.pass).length,
      checks: checks.length,
      allPass: rs.filter((r) => r.checks.length > 0 && r.checks.every((c) => c.pass)).length,
      medianCalls: median(rs.map((r) => r.metrics.calls)),
      errorsPerRun: rs.reduce((n, r) => n + r.metrics.errors, 0) / rs.length,
      retriesPerRun: rs.reduce((n, r) => n + r.metrics.retries, 0) / rs.length,
      deprecatedCalls: rs.reduce((n, r) => n + r.metrics.deprecatedCalls, 0),
      unfinished: rs.filter((r) => !r.metrics.finished).length,
      medianSeconds: median(rs.map((r) => (r.metrics.durationMs ?? 0) / 1000)),
      costUsd: rs.reduce((n, r) => n + (r.metrics.costUsd ?? 0), 0),
    };
  });
}

// Each check that failed in RECURRING or more runs, with the runs it failed in.
export function recurringCheckFailures(runs) {
  const failed = runs.flatMap((r) =>
    r.checks
      .filter((c) => !c.pass)
      .map((c) => ({ key: `${r.task} · ${c.name}`, run: r, detail: c.detail })),
  );
  return [...groupBy(failed, (f) => f.key)]
    .map(([key, fs]) => ({
      key,
      count: fs.length,
      of: runs.filter((r) => r.task === fs[0].run.task).length,
      models: [...new Set(fs.map((f) => f.run.model))],
      detail: fs.find((f) => f.detail)?.detail ?? null,
    }))
    .filter((g) => g.count >= RECURRING)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

// Each (tool, error) that happened in RECURRING or more runs, counted once per run.
export function recurringToolErrors(runs) {
  const seen = runs.flatMap((r) =>
    [...new Set(r.errors.map((e) => `${e.tool}\u0000${normaliseError(e.error)}`))].map((k) => ({
      k,
      run: r,
    })),
  );
  return [...groupBy(seen, (s) => s.k)]
    .map(([k, ss]) => {
      const [tool, error] = k.split('\u0000');
      const example = ss[0].run.errors.find(
        (e) => e.tool === tool && normaliseError(e.error) === error,
      );
      return {
        tool,
        error,
        example: example?.error ?? error,
        runs: ss.length,
        tasks: [...new Set(ss.map((s) => s.run.task))],
        models: [...new Set(ss.map((s) => s.run.model))],
      };
    })
    .filter((g) => g.runs >= RECURRING)
    .sort((a, b) => b.runs - a.runs);
}

function table(head, rows) {
  return [
    `| ${head.join(' | ')} |`,
    `| ${head.map(() => '---').join(' | ')} |`,
    ...rows.map((r) => `| ${r.join(' | ')} |`),
  ].join('\n');
}

export function summarise(results) {
  const { runs, meta } = results;
  const models = [...new Set(runs.map((r) => r.model))];
  const out = [`# Benchmark ${results.round}`, ''];
  out.push(
    `Commit ${meta.commit?.slice(0, 9) ?? '?'} · ${runs.length} runs · ${meta.toolCount} tools ` +
      `(${meta.toolChars.toLocaleString('en-GB')} characters of names, descriptions and schemas)`,
    '',
    ...(results.excluded?.length
      ? [`Left out, the MCP never connected: ${results.excluded.join(', ')}.`, '']
      : []),
    '## By model',
    '',
    table(
      [
        'Model',
        'Runs',
        'Checks passed',
        'Runs fully right',
        'Median calls',
        'Errors/run',
        'Retries/run',
        'Deprecated calls',
        'Unfinished',
        'Median s',
        'Cost $',
      ],
      modelRows(runs).map((m) => [
        m.model,
        m.runs,
        `${m.checksPassed}/${m.checks} (${pct(m.checksPassed, m.checks)})`,
        `${m.allPass}/${m.runs} (${pct(m.allPass, m.runs)})`,
        fixed(m.medianCalls, 0),
        fixed(m.errorsPerRun, 2),
        fixed(m.retriesPerRun, 2),
        m.deprecatedCalls,
        m.unfinished,
        fixed(m.medianSeconds, 0),
        fixed(m.costUsd, 2),
      ]),
    ),
    '',
    '## By task',
    '',
    'Checks passed, averaged over the runs; then errors per run.',
    '',
  );
  const byTask = groupBy(runs, (r) => r.task);
  out.push(
    table(
      ['Task', ...models.flatMap((m) => [m, `${m} errors`])],
      [...byTask].map(([task, rs]) => [
        task,
        ...models.flatMap((m) => {
          const mine = rs.filter((r) => r.model === m);
          if (mine.length === 0) return ['', ''];
          const fr = mine.map(passFraction).filter((x) => x !== null);
          const avg = fr.length ? fr.reduce((a, b) => a + b, 0) / fr.length : null;
          return [
            avg === null ? 'no checks' : pct(avg, 1),
            fixed(mine.reduce((n, r) => n + r.metrics.errors, 0) / mine.length, 1),
          ];
        }),
      ]),
    ),
    '',
    `## Checks failing in ${RECURRING}+ runs`,
    '',
  );
  const failures = recurringCheckFailures(runs);
  out.push(
    failures.length
      ? table(
          ['Task · check', 'Failed', 'Models', 'Example'],
          failures.map((f) => [
            f.key,
            `${f.count}/${f.of}`,
            f.models.join(', '),
            (f.detail ?? '').replace(/\|/g, '\\|'),
          ]),
        )
      : 'None.',
    '',
    `## Tool errors in ${RECURRING}+ runs`,
    '',
  );
  const errors = recurringToolErrors(runs);
  out.push(
    errors.length
      ? table(
          ['Tool', 'Error', 'Runs', 'Tasks', 'Models'],
          errors.map((e) => [
            e.tool,
            e.example.replace(/\|/g, '\\|').slice(0, 220),
            e.runs,
            e.tasks.join(' '),
            e.models.join(', '),
          ]),
        )
      : 'None.',
    '',
  );
  const deprecated = groupBy(
    runs.flatMap((r) =>
      r.tools.filter((t) => results.deprecated.includes(t)).map((t) => ({ t, r })),
    ),
    (x) => x.t,
  );
  if (deprecated.size) {
    out.push('## Deprecated tools called', '');
    out.push(
      table(
        ['Tool', 'Calls', 'Runs', 'Models'],
        [...deprecated].map(([t, xs]) => [
          t,
          xs.length,
          new Set(xs.map((x) => x.r.name)).size,
          [...new Set(xs.map((x) => x.r.model))].join(', '),
        ]),
      ),
      '',
    );
  }
  return out.join('\n');
}

// What moved from `before` to `after`, on the tasks and models both rounds ran.
export function compareRounds(before, after) {
  const out = [`## Compared with ${before.round}`, ''];
  const key = (r) => `${r.task}\u0000${r.model}`;
  const avg = (rs) => {
    const fr = rs.map(passFraction).filter((x) => x !== null);
    return fr.length ? fr.reduce((a, b) => a + b, 0) / fr.length : null;
  };
  const was = groupBy(before.runs, key);
  const now = groupBy(after.runs, key);
  const rows = [];
  for (const [k, rs] of now) {
    if (!was.has(k)) continue;
    const [task, model] = k.split('\u0000');
    const a = avg(was.get(k));
    const b = avg(rs);
    const ea = was.get(k).reduce((n, r) => n + r.metrics.errors, 0) / was.get(k).length;
    const eb = rs.reduce((n, r) => n + r.metrics.errors, 0) / rs.length;
    if (a === b && ea === eb) continue;
    rows.push([
      task,
      model,
      `${pct(a ?? 0, 1)} → ${pct(b ?? 0, 1)}`,
      `${fixed(ea)} → ${fixed(eb)}`,
    ]);
  }
  out.push(
    rows.length ? table(['Task', 'Model', 'Checks passed', 'Errors/run'], rows) : 'Nothing moved.',
    '',
  );
  const models = new Map(modelRows(before.runs).map((m) => [m.model, m]));
  out.push(
    table(
      ['Model', 'Checks passed', 'Errors/run', 'Median calls'],
      modelRows(after.runs)
        .filter((m) => models.has(m.model))
        .map((m) => {
          const p = models.get(m.model);
          return [
            m.model,
            `${pct(p.checksPassed, p.checks)} → ${pct(m.checksPassed, m.checks)}`,
            `${fixed(p.errorsPerRun, 2)} → ${fixed(m.errorsPerRun, 2)}`,
            `${fixed(p.medianCalls, 0)} → ${fixed(m.medianCalls, 0)}`,
          ];
        }),
    ),
    '',
  );
  return out.join('\n');
}
