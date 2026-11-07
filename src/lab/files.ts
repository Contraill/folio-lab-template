/* A run as a file: to keep it outside the browser, move it to another device or share it. Imported files are
   untrusted: they are checked against the experiment before anything is stored or drawn. */
import { newId } from './runner.ts';
import type { Experiment, Run } from './types.ts';

export const FORMAT = 'folio-lab-run';
export const FORMAT_VERSION = 1;
export const MAX_BYTES = 20 * 1024 * 1024;

export type RunFile<C, S> = { format: typeof FORMAT; formatVersion: number; exportedAt: string; run: Run<C, S> };

export function exportRun<C, S>(run: Run<C, S>): string {
  const file: RunFile<C, S> = { format: FORMAT, formatVersion: FORMAT_VERSION, exportedAt: new Date().toISOString(), run };
  return JSON.stringify(file);
}

const finite = (m: unknown) => !!m && typeof m === 'object' && Object.values(m).every((v) => typeof v === 'number' && Number.isFinite(v));
const isStep = (n: unknown, max: number) => Number.isInteger(n) && (n as number) >= 0 && (n as number) <= max;

/** The run in a file, under a new id so it never replaces one already here; throws with a reason otherwise. */
export function importRun<C, S, M>(exp: Experiment<C, S, M>, text: string): Run<C, S> {
  if (text.length > MAX_BYTES) throw new Error('The file is too large for a run.');
  let file: RunFile<C, S>;
  try { file = JSON.parse(text); } catch { throw new Error('The file is not JSON.'); }
  if (file?.format !== FORMAT) throw new Error('The file is not a lab run.');
  if (file.formatVersion !== FORMAT_VERSION) throw new Error(`The file is format version ${file.formatVersion}; this app reads ${FORMAT_VERSION}.`);
  const run = file.run;
  if (run?.experiment !== exp.id) throw new Error(`The run belongs to “${run?.experiment}”, not to this experiment.`);
  if (run.version !== exp.version) throw new Error(`The run was made by version ${run.version} of the experiment; this is version ${exp.version}.`);
  const ok = isStep(run.step, exp.maxSteps) && Number.isInteger(run.seed) && Number.isInteger(run.rng)
    && Array.isArray(run.history) && run.history.length <= exp.maxSteps + 1 && run.history.every((h) => isStep(h?.step, exp.maxSteps) && finite(h.metrics))
    && Array.isArray(run.checkpoints) && run.checkpoints.length <= 200 && run.checkpoints.every((c) => isStep(c?.step, run.step) && finite(c.metrics) && Number.isInteger(c.rng));
  if (!ok) throw new Error('The run in the file is damaged.');
  // Snapshots must restore: a broken one fails here, not later in the middle of a comparison.
  try { for (const s of [...run.checkpoints.map((c) => c.state), ...(run.latest === undefined ? [] : [run.latest])]) exp.restore(s, run.config); }
  catch { throw new Error('A saved model in the file cannot be restored.'); }
  return { ...run, id: newId(), config: { ...exp.defaults, ...run.config } };
}
