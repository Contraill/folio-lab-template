import assert from 'node:assert/strict';
import { test } from 'node:test';
import { spiralsExperiment as exp } from '../src/experiments/spirals.ts';
import { exportRun, importRun } from '../src/lab/files.ts';
import { advance, createRun, mark, resume, rewind, snapshot } from '../src/lab/runner.ts';

test('rounds 100, 500 and 1000 are checkpointed, and the network learns between them', () => {
  let { run, model } = createRun(exp, 7);
  run = advance(exp, run, model, 1000);
  assert.equal(run.step, 1000);
  assert.deepEqual(run.checkpoints.map((c) => c.step), [100, 500, 1000]);
  assert.equal(run.history.length, 101, 'every 10 rounds, and the start');
  const [early, , late] = run.checkpoints;
  assert.ok(late.metrics.loss < early.metrics.loss / 2, `loss ${early.metrics.loss} → ${late.metrics.loss}`);
  assert.ok(late.metrics.accuracy > 0.9, `accuracy ${late.metrics.accuracy}`);
});

test('the same seed gives the same run, and a run continues exactly from a checkpoint', () => {
  const a = createRun(exp, 3), b = createRun(exp, 3);
  const ra = advance(exp, a.run, a.model, 600), rb = advance(exp, b.run, b.model, 600);
  assert.deepEqual(ra.checkpoints.map((c) => c.metrics), rb.checkpoints.map((c) => c.metrics));
  const back = rewind(exp, ra, 500);
  const again = advance(exp, back.run, back.model, 100);
  assert.deepEqual(again.history.at(-1), ra.history.at(-1), 'round 600 again, from the checkpoint at 500');
  assert.ok(advance(exp, ra, a.model, 99999).step === exp.maxSteps, 'never past the last round');
});

test('a run saved, exported and imported reopens where it stopped', () => {
  let { run, model } = createRun(exp, 11);
  run = mark(exp, advance(exp, run, model, 150), model, 'before the bend');
  const stored = snapshot(exp, run, model);
  const imported = importRun(exp, exportRun(stored));
  assert.notEqual(imported.id, stored.id, 'an import never replaces a run already here');
  assert.equal(imported.checkpoints.find((c) => c.step === 150)?.note, 'before the bend');
  const reopened = resume(exp, imported);
  assert.deepEqual(exp.metrics(reopened.model), exp.metrics(model));
});

test('an import is checked before anything is kept', () => {
  const { run, model } = createRun(exp, 5);
  const good = JSON.parse(exportRun(snapshot(exp, advance(exp, run, model, 20), model)));
  const bad = (change: (f: typeof good) => void) => { const f = structuredClone(good); change(f); return JSON.stringify(f); };
  assert.throws(() => importRun(exp, 'not json'), /not JSON/);
  assert.throws(() => importRun(exp, bad((f) => { f.format = 'other'; })), /not a lab run/);
  assert.throws(() => importRun(exp, bad((f) => { f.run.experiment = 'another'; })), /belongs to/);
  assert.throws(() => importRun(exp, bad((f) => { f.run.version = 99; })), /version/);
  assert.throws(() => importRun(exp, bad((f) => { f.run.history[0].metrics.loss = 'x'; })), /damaged/);
  assert.throws(() => importRun(exp, bad((f) => { f.run.step = 1e9; })), /damaged/);
  assert.throws(() => importRun(exp, bad((f) => { f.run.latest.net.w[0] = [1]; })), /cannot be restored/);
});

test('storage is named after the app\'s place in Folio, so two apps on the site never share it', async () => {
  const { namespace } = await import('../src/lab/folio.ts');
  assert.equal(namespace('/play/gates/app/'), 'play:gates:');
  assert.equal(namespace('/lab/two-spirals/app/index.html'), 'lab:two-spirals:');
  assert.equal(namespace('/'), '', 'opened anywhere else (vite dev): no prefix');
  assert.equal(namespace('/play/Gates/app/'), '');
});
