/* The pilot experiment: a small neural network (2 → 24 → 24 → 1, tanh, sigmoid output) learns to tell two
   interleaved spirals apart. One round is one pass over the 200 points (full batch, Adam). The data comes from the
   run's seed, so a run is reproducible; the picture is the network's opinion over the whole plane. */
import type { Rng } from '../lab/rng.ts';
import type { Experiment, Palette } from '../lab/types.ts';

export type Config = { hidden: number; rate: number; noise: number; turns: number };
type Net = { sizes: number[]; w: number[][]; b: number[][] };
export type Snapshot = { net: Net; m: Net; v: Net; t: number; rate: number; points: number[]; labels: number[] };
type Model = Snapshot;

const zeros = (sizes: number[]): Net => ({ sizes, w: sizes.slice(1).map((n, i) => new Array(n * sizes[i]).fill(0)), b: sizes.slice(1).map((n) => new Array(n).fill(0)) });
const copy = (n: Net): Net => ({ sizes: [...n.sizes], w: n.w.map((a) => [...a]), b: n.b.map((a) => [...a]) });

/** Activations of every layer for one point. */
function forward(net: Net, x: number, y: number): number[][] {
  const acts = [[x, y]];
  for (let l = 0; l < net.w.length; l++) {
    const input = acts[l], n = net.sizes[l + 1], out = new Array(n);
    for (let j = 0; j < n; j++) {
      let z = net.b[l][j];
      for (let i = 0; i < input.length; i++) z += net.w[l][j * input.length + i] * input[i];
      out[j] = l === net.w.length - 1 ? 1 / (1 + Math.exp(-z)) : Math.tanh(z);
    }
    acts.push(out);
  }
  return acts;
}
export const predict = (net: Net, x: number, y: number) => forward(net, x, y).at(-1)![0];

function spirals(count: number, turns: number, noise: number, rng: Rng) {
  const points: number[] = [], labels: number[] = [];
  for (let i = 0; i < count; i++) {
    const t = (i / count) * turns * Math.PI * 2 + 0.6, r = t / (turns * Math.PI * 2 + 0.6);
    for (const label of [0, 1]) {
      const a = t + label * Math.PI;
      points.push(r * Math.cos(a) + (rng.next() - 0.5) * noise, r * Math.sin(a) + (rng.next() - 0.5) * noise);
      labels.push(label);
    }
  }
  return { points, labels };
}

const B1 = 0.9, B2 = 0.999;

export const spiralsExperiment: Experiment<Config, Snapshot, Model> = {
  id: 'two-spirals',
  version: 1,
  title: { en: 'Two Spirals', tr: 'İki Sarmal' },
  // Tuned so that round 100 is still confused, 500 has the shape and 1000 is sure of it.
  defaults: { hidden: 24, rate: 0.005, noise: 0.06, turns: 1.25 },
  milestones: [100, 500, 1000],
  maxSteps: 2000,
  historyEvery: 10,
  metricInfo: {
    loss: { label: { en: 'Loss', tr: 'Kayıp' }, format: (v) => v.toFixed(3), better: 'lower' },
    accuracy: { label: { en: 'Accuracy', tr: 'Doğruluk' }, format: (v) => `${(v * 100).toFixed(1)}%`, better: 'higher' },
  },

  init(config, rng) {
    const sizes = [2, config.hidden, config.hidden, 1];
    const net = zeros(sizes);
    // Xavier-style start: small random weights, scaled by layer width.
    net.w.forEach((layer, l) => { const scale = Math.sqrt(2 / (sizes[l] + sizes[l + 1])); for (let i = 0; i < layer.length; i++) layer[i] = (rng.next() * 2 - 1) * scale * 1.7; });
    return { net, m: zeros(sizes), v: zeros(sizes), t: 0, rate: config.rate, ...spirals(100, config.turns, config.noise, rng) };
  },

  step(model) {
    const { net, points, labels } = model;
    const grad = zeros(net.sizes);
    const n = labels.length;
    for (let p = 0; p < n; p++) {
      const acts = forward(net, points[2 * p], points[2 * p + 1]);
      // Output delta for sigmoid with cross-entropy; tanh layers backpropagate through 1 - a².
      let delta = [acts.at(-1)![0] - labels[p]];
      for (let l = net.w.length - 1; l >= 0; l--) {
        const input = acts[l];
        for (let j = 0; j < delta.length; j++) {
          grad.b[l][j] += delta[j] / n;
          for (let i = 0; i < input.length; i++) grad.w[l][j * input.length + i] += (delta[j] * input[i]) / n;
        }
        if (l === 0) break;
        delta = input.map((a, i) => (1 - a * a) * delta.reduce((s, d, j) => s + d * net.w[l][j * input.length + i], 0));
      }
    }
    model.t++;
    const rate = model.rate;
    for (const key of ['w', 'b'] as const) net[key].forEach((layer, l) => {
      for (let i = 0; i < layer.length; i++) {
        const g = grad[key][l][i];
        const m = (model.m[key][l][i] = B1 * model.m[key][l][i] + (1 - B1) * g);
        const v = (model.v[key][l][i] = B2 * model.v[key][l][i] + (1 - B2) * g * g);
        layer[i] -= (rate * (m / (1 - B1 ** model.t))) / (Math.sqrt(v / (1 - B2 ** model.t)) + 1e-8);
      }
    });
  },

  metrics({ net, points, labels }) {
    let loss = 0, right = 0;
    for (let p = 0; p < labels.length; p++) {
      const q = Math.min(1 - 1e-7, Math.max(1e-7, predict(net, points[2 * p], points[2 * p + 1])));
      loss -= labels[p] ? Math.log(q) : Math.log(1 - q);
      if ((q > 0.5 ? 1 : 0) === labels[p]) right++;
    }
    return { loss: loss / labels.length, accuracy: right / labels.length };
  },

  save: (model) => ({ net: copy(model.net), m: copy(model.m), v: copy(model.v), t: model.t, rate: model.rate, points: [...model.points], labels: [...model.labels] }),

  restore(state) {
    const sizes = state?.net?.sizes;
    const layers = (net: Net) => Array.isArray(net?.w) && net.w.length === sizes.length - 1 && net.w.every((w, l) => Array.isArray(w) && w.length === sizes[l] * sizes[l + 1] && w.every(Number.isFinite));
    if (!Array.isArray(sizes) || sizes.length !== 4 || !layers(state.net) || !layers(state.m) || !layers(state.v) || !(state.rate > 0) || state.points.length !== state.labels.length * 2) throw new Error('not a Two Spirals snapshot');
    return spiralsExperiment.save(state);
  },

  draw(ctx, { net, points, labels }, w, h, p: Palette) {
    const size = Math.min(w, h), ox = (w - size) / 2, oy = (h - size) / 2, cells = 64;
    ctx.fillStyle = p.surface; ctx.fillRect(0, 0, w, h);
    const colour = [p.signal, p.danger];
    // The network's opinion on a small grid, scaled up smoothly: confident regions take their class colour.
    const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const [base, a, b] = [rgb(p.surface), rgb(colour[0]), rgb(colour[1])];
    const field = new ImageData(cells, cells);
    for (let j = 0; j < cells; j++) for (let i = 0; i < cells; i++) {
      const q = predict(net, ((i + 0.5) / cells) * 2.4 - 1.2, ((j + 0.5) / cells) * 2.4 - 1.2);
      const tint = q > 0.5 ? b : a, k = Math.abs(q - 0.5) * 0.9, o = (j * cells + i) * 4;
      for (let c = 0; c < 3; c++) field.data[o + c] = base[c] + (tint[c] - base[c]) * k;
      field.data[o + 3] = 255;
    }
    const small = Object.assign(document.createElement('canvas'), { width: cells, height: cells });
    small.getContext('2d')!.putImageData(field, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(small, ox, oy, size, size);
    ctx.globalAlpha = 1;
    const px = (v: number) => ((v + 1.2) / 2.4) * size;
    for (let k = 0; k < labels.length; k++) {
      ctx.beginPath(); ctx.arc(ox + px(points[2 * k]), oy + px(points[2 * k + 1]), Math.max(2, size / 140), 0, Math.PI * 2);
      ctx.fillStyle = colour[labels[k]]; ctx.fill();
      ctx.lineWidth = 1; ctx.strokeStyle = p.ink; ctx.stroke();
    }
  },
};
