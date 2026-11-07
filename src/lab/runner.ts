/* Runs an experiment round by round. Pure apart from the clock: given a run and a model it returns the next run, so
   the same code is tested in Node and used in the page. */
import { createRng } from './rng.ts';
import type { Experiment, Run } from './types.ts';

export const newId = () => crypto.randomUUID();
const now = () => new Date().toISOString();

export function createRun<C, S, M>(exp: Experiment<C, S, M>, seed: number, config: C = exp.defaults): { run: Run<C, S>; model: M } {
  const rng = createRng(seed);
  const model = exp.init(config, rng);
  const at = now();
  const run: Run<C, S> = { id: newId(), experiment: exp.id, version: exp.version, seed, config, createdAt: at, updatedAt: at, step: 0, rng: rng.state, history: [{ step: 0, metrics: exp.metrics(model) }], checkpoints: [] };
  return { run, model };
}

/** Takes up to `rounds` rounds (never past maxSteps), recording history and checkpointing at milestones. */
export function advance<C, S, M>(exp: Experiment<C, S, M>, run: Run<C, S>, model: M, rounds: number): Run<C, S> {
  const rng = createRng(run.rng);
  let { step } = run;
  const history = [...run.history];
  const checkpoints = [...run.checkpoints];
  const end = Math.min(exp.maxSteps, step + Math.max(0, Math.floor(rounds)));
  while (step < end) {
    exp.step(model, rng);
    step++;
    const due = step % exp.historyEvery === 0, milestone = exp.milestones.includes(step);
    if (!due && !milestone) continue;
    const metrics = exp.metrics(model);
    if (due) history.push({ step, metrics });
    if (milestone && !checkpoints.some((c) => c.step === step)) checkpoints.push({ step, at: now(), metrics, state: exp.save(model), rng: rng.state });
  }
  return { ...run, step, rng: rng.state, history, checkpoints, updatedAt: now() };
}

/** Saves the model as it is now, with a note: a checkpoint of the visitor's own choosing. */
export function mark<C, S, M>(exp: Experiment<C, S, M>, run: Run<C, S>, model: M, note?: string): Run<C, S> {
  const others = run.checkpoints.filter((c) => c.step !== run.step);
  const checkpoint = { step: run.step, at: now(), metrics: exp.metrics(model), state: exp.save(model), rng: run.rng, ...(note ? { note } : {}) };
  return { ...run, checkpoints: [...others, checkpoint].sort((a, b) => a.step - b.step), updatedAt: now() };
}

/** Goes back to a checkpoint: the run continues from there, forgetting what came after. */
export function rewind<C, S, M>(exp: Experiment<C, S, M>, run: Run<C, S>, step: number): { run: Run<C, S>; model: M } {
  const c = run.checkpoints.find((k) => k.step === step);
  if (!c) throw new Error(`no checkpoint at round ${step}`);
  return {
    model: exp.restore(c.state, run.config),
    run: { ...run, step, rng: c.rng, latest: c.state, history: run.history.filter((h) => h.step <= step), checkpoints: run.checkpoints.filter((k) => k.step <= step), updatedAt: now() },
  };
}

/** The run ready to be stored: with its model as it is now. */
export const snapshot = <C, S, M>(exp: Experiment<C, S, M>, run: Run<C, S>, model: M): Run<C, S> => ({ ...run, latest: exp.save(model) });

/** Reopens a stored run where it stopped; without a saved model, from its last checkpoint, or from the start. */
export function resume<C, S, M>(exp: Experiment<C, S, M>, run: Run<C, S>): { run: Run<C, S>; model: M } {
  if (run.latest !== undefined) return { run, model: exp.restore(run.latest, run.config) };
  const last = run.checkpoints.at(-1);
  if (last) return rewind(exp, run, last.step);
  const fresh = createRun(exp, run.seed, run.config);
  return { model: fresh.model, run: { ...fresh.run, id: run.id, createdAt: run.createdAt } };
}
