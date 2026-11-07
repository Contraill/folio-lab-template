import { spiralsExperiment as exp } from './experiments/spirals.ts';
import { chart, fit } from './lab/chart.ts';
import { exportRun, importRun } from './lab/files.ts';
import { folioContext } from './lab/folio.ts';
import { advance, createRun, mark, resume, rewind, snapshot } from './lab/runner.ts';
import { deleteRun, listRuns, putRun } from './lab/store.ts';
import type { Run } from './lab/types.ts';
import './styles.css';

type R = Run<typeof exp.defaults, ReturnType<typeof exp.save>>;
type M = ReturnType<typeof exp.init>;

const TEXT = {
  en: { round: 'Round', run: 'Run', pause: 'Pause', mark: 'Checkpoint', reset: 'New run', checkpoints: 'Checkpoints', compare: 'Compare', compareHint: 'Pick up to three checkpoints.', runs: 'Saved on this device', none: 'Nothing yet.', open: 'Open', remove: 'Delete', from: 'Continue from here', export: 'Export run', import: 'Import a run', imported: 'Run imported.', saved: 'Saved.', storeless: 'This browser keeps nothing: export a run to keep it.', done: 'Last round reached.', at: 'round {n}', view: 'What the network thinks, over the whole plane', chartLabel: 'Loss over the rounds' },
  tr: { round: 'Tur', run: 'Çalıştır', pause: 'Duraklat', mark: 'Kontrol noktası', reset: 'Yeni deneme', checkpoints: 'Kontrol noktaları', compare: 'Karşılaştır', compareHint: 'En çok üç kontrol noktası seç.', runs: 'Bu cihazda kayıtlı', none: 'Henüz yok.', open: 'Aç', remove: 'Sil', from: 'Buradan devam et', export: 'Denemeyi dışa aktar', import: 'Deneme içe aktar', imported: 'Deneme içe aktarıldı.', saved: 'Kaydedildi.', storeless: 'Bu tarayıcı hiçbir şey saklamıyor: saklamak için denemeyi dışa aktar.', done: 'Son tura ulaşıldı.', at: '{n}. tur', view: 'Ağın düzlemin tamamı için düşündüğü', chartLabel: 'Turlar boyunca kayıp' },
};
const { lang, palette, embedded } = folioContext();
const t = TEXT[lang];
document.documentElement.lang = lang;
for (const [k, v] of Object.entries(palette)) document.documentElement.style.setProperty(`--${k}`, v);
document.body.classList.toggle('embedded', embedded);
document.title = exp.title[lang];

const $ = <T extends HTMLElement>(sel: string) => document.querySelector<T>(sel)!;
document.querySelectorAll<HTMLElement>('[data-t]').forEach((el) => { el.textContent = t[el.dataset.t as keyof typeof t]; });
$('h1').textContent = exp.title[lang];
const view = $<HTMLCanvasElement>('#view'), plot = $<HTMLCanvasElement>('#chart');
view.setAttribute('aria-label', t.view); plot.setAttribute('aria-label', t.chartLabel);
const say = (text: string) => { $('#say').textContent = text; };

let { run, model }: { run: R; model: M } = createRun(exp, Date.now() % 1e9);
let running = false;
let chosen: number[] = [];
let storage = true;

async function save() {
  if (run.step === 0 && !run.checkpoints.length) return; // an untouched run isn't worth keeping
  try { await putRun(snapshot(exp, run, model)); } catch { if (storage) say(t.storeless); storage = false; }
  await listSaved();
}

// Drawn only when something changed: a paused run costs nothing.
let dirty = true;
const changed = () => { dirty = true; };
new ResizeObserver(changed).observe(view);

function frame() {
  if (running) {
    dirty = true;
    // As many rounds as fit in a few milliseconds: the page stays responsive on a slow device.
    const start = performance.now(), before = run.checkpoints.length;
    while (running && performance.now() - start < 8 && run.step < exp.maxSteps) run = advance(exp, run, model, 1);
    if (run.checkpoints.length !== before) { showCheckpoints(); save(); }
    if (run.step >= exp.maxSteps) { setRunning(false); say(t.done); }
  }
  if (dirty) { dirty = false; draw(); }
  requestAnimationFrame(frame);
}

function draw() {
  const v = fit(view);
  exp.draw(v.ctx, model, v.w, v.h, palette);
  const c = fit(plot);
  chart(c.ctx, c.w, c.h, run.history.map((h) => ({ step: h.step, value: h.metrics.loss })), exp.maxSteps, exp.milestones, palette);
  $('#step').textContent = String(run.step);
  const live = exp.metrics(model);
  $('#metrics').replaceChildren(...Object.entries(exp.metricInfo).map(([key, info]) => row(info.label[lang], info.format(live[key]))));
}
const row = (k: string, v: string) => { const d = document.createElement('div'); d.innerHTML = '<dt></dt><dd></dd>'; d.children[0].textContent = k; d.children[1].textContent = v; return d; };

function setRunning(on: boolean) {
  running = on && run.step < exp.maxSteps;
  $('#run').textContent = running ? t.pause : t.run;
  $('#run').setAttribute('aria-pressed', String(running));
  if (!running) save();
}

function showCheckpoints() {
  changed();
  const list = $('#checkpoints');
  list.replaceChildren(...run.checkpoints.map((c) => {
    const li = document.createElement('li');
    const pick = document.createElement('button');
    pick.type = 'button'; pick.className = 'pick'; pick.setAttribute('aria-pressed', String(chosen.includes(c.step)));
    pick.textContent = `${t.at.replace('{n}', String(c.step))}${c.note ? ` · ${c.note}` : ''}`;
    pick.onclick = () => { chosen = chosen.includes(c.step) ? chosen.filter((s) => s !== c.step) : [...chosen, c.step].slice(-3); showCheckpoints(); };
    const back = document.createElement('button');
    back.type = 'button'; back.className = 'quiet'; back.textContent = t.from;
    back.onclick = () => { setRunning(false); ({ run, model } = rewind(exp, run, c.step)); chosen = chosen.filter((s) => s <= c.step); showCheckpoints(); save(); };
    li.append(pick, back);
    return li;
  }));
  showCompare();
}

function showCompare() {
  const box = $('#compare');
  const picked = (chosen.length ? chosen : exp.milestones).map((s) => run.checkpoints.find((c) => c.step === s)).filter((c) => !!c);
  box.replaceChildren(...picked.sort((a, b) => a.step - b.step).map((c) => {
    const fig = document.createElement('figure');
    const canvas = document.createElement('canvas');
    canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', `${t.view}, ${t.at.replace('{n}', String(c.step))}`);
    const cap = document.createElement('figcaption');
    cap.textContent = [t.at.replace('{n}', String(c.step)), ...Object.entries(exp.metricInfo).map(([k, info]) => `${info.label[lang]} ${info.format(c.metrics[k])}`)].join(' · ');
    fig.append(canvas, cap);
    requestAnimationFrame(() => { const f = fit(canvas); exp.draw(f.ctx, exp.restore(c.state, run.config), f.w, f.h, palette); });
    return fig;
  }));
  $('#compare-hint').hidden = picked.length > 0;
}

async function listSaved() {
  let runs: R[] = [];
  try { runs = await listRuns(exp.id); } catch { storage = false; }
  const list = $('#runs');
  list.replaceChildren(...runs.map((r) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${new Date(r.updatedAt).toLocaleString(lang)} · ${t.at.replace('{n}', String(r.step))}`;
    const open = document.createElement('button');
    open.type = 'button'; open.className = 'quiet'; open.textContent = t.open; open.disabled = r.id === run.id;
    open.onclick = () => { setRunning(false); ({ run, model } = resume(exp, r)); chosen = []; showCheckpoints(); listSaved(); };
    const remove = document.createElement('button');
    remove.type = 'button'; remove.className = 'quiet'; remove.textContent = t.remove;
    remove.onclick = async () => { await deleteRun(r.id); listSaved(); };
    li.append(label, open, remove);
    return li;
  }));
  $('#runs-empty').hidden = runs.length > 0;
}

$('#run').onclick = () => setRunning(!running);
$('#mark').onclick = () => { run = mark(exp, run, model); showCheckpoints(); save(); };
$('#reset').onclick = () => { setRunning(false); ({ run, model } = createRun(exp, Date.now() % 1e9)); chosen = []; showCheckpoints(); };
$('#export').onclick = () => {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([exportRun(snapshot(exp, run, model))], { type: 'application/json' }));
  a.download = `${exp.id}-round-${run.step}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
};
$<HTMLInputElement>('#import').onchange = async (e) => {
  const input = e.target as HTMLInputElement, file = input.files?.[0];
  input.value = '';
  if (!file) return;
  try {
    const imported = importRun(exp, await file.text());
    setRunning(false);
    ({ run, model } = resume(exp, imported));
    chosen = []; showCheckpoints(); await save(); say(t.imported);
  } catch (err) { say((err as Error).message); }
};
document.addEventListener('visibilitychange', () => { if (document.hidden) setRunning(false); });

// Reopens the latest run kept on this device, where it stopped.
listRuns<R['config'], ReturnType<typeof exp.save>>(exp.id).then((runs) => { if (runs[0]) ({ run, model } = resume(exp, runs[0])); }).catch(() => { storage = false; })
  .finally(() => { showCheckpoints(); listSaved(); requestAnimationFrame(frame); });
