/* The lab's model, independent of what learns or simulates. An experiment says how to start, take one round
   (an epoch, a generation, a tick), measure itself, and save and restore a snapshot; the runner does the rest:
   rounds, metric history, checkpoints at fixed rounds, saving and files. A neural network, a genetic algorithm, a
   reinforcement learner or a physics simulation each fit the same interface. */
import type { Rng } from './rng.ts';

export type Lang = 'en' | 'tr';
export type Metrics = Record<string, number>;
export type Palette = { bg: string; surface: string; ink: string; mute: string; accent: string; signal: string; danger: string };

/** A snapshot of the model at a round: everything needed to show it, compare it or continue from it. */
export type Checkpoint<S> = { step: number; at: string; metrics: Metrics; state: S; rng: number; note?: string };

export type Run<C, S> = {
  id: string; experiment: string; version: number; seed: number; config: C;
  createdAt: string; updatedAt: string; step: number; rng: number;
  /** Metrics every `historyEvery` rounds, for charts. */
  history: { step: number; metrics: Metrics }[];
  checkpoints: Checkpoint<S>[];
  /** The model at `step`, written when the run is saved, so it reopens where it stopped. */
  latest?: S;
};

export interface Experiment<C, S, M> {
  id: string;
  /** Raise it when saved snapshots of an older version can no longer be restored. */
  version: number;
  title: Record<Lang, string>;
  defaults: C;
  /** Rounds that are checkpointed by themselves, to compare behaviour early and late. */
  milestones: number[];
  maxSteps: number;
  historyEvery: number;
  /** Names of the metrics, how to show them and which way is better. */
  metricInfo: Record<string, { label: Record<Lang, string>; format: (v: number) => string; better: 'lower' | 'higher' }>;
  init(config: C, rng: Rng): M;
  step(model: M, rng: Rng): void;
  metrics(model: M): Metrics;
  save(model: M): S;
  restore(state: S, config: C): M;
  /** Draws the model; a 3D experiment would draw with WebGL into the same canvas. */
  draw(ctx: CanvasRenderingContext2D, model: M, w: number, h: number, palette: Palette): void;
}
