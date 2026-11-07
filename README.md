# Folio lab template

A starting point for experiments with learning systems and simulations that show up on [Folio](https://oztozlu.dev/lab) by themselves. The lab gives every experiment the same bench: run and pause, rounds counted, metrics recorded, checkpoints at fixed rounds (100, 500 and 1000 by default) and at will, side-by-side comparison of checkpoints, continuing from any checkpoint, runs kept in the browser, and runs as files to keep or share.

The pilot, **Two Spirals**, is a small neural network (2 → 24 → 24 → 1, written out in plain TypeScript) learning to tell two spirals apart. At round 100 it is still guessing, at 500 it has the shape, at 1000 it is sure of it.

## Start an experiment

1. **Use this template** on GitHub and name the repository; the name becomes its address (`<name>.oztozlu.dev`) unless `folio.yaml` sets `name`. The repository may be public or private.
2. Rename it in `package.json` and the `<title>` in `index.html`, write your experiment in `src/experiments/` (below), import it in `src/main.ts` instead of the spirals, and fill in `folio.yaml`.
3. Push to `main`. The Folio controller builds it, publishes it at its address and adds it to Folio's `/lab` page; every later push updates it. No secrets, topics, DNS or Cloudflare settings: the first commit made by "Use this template" is picked up within 15 minutes, every push within a minute or two.

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # the runner, files and the pilot's learning, in Node
pnpm build      # type check, then dist/
```

Requires Node 26 (`.node-version`) and pnpm 12.

## An experiment

An experiment is an object implementing `Experiment<Config, Snapshot, Model>` (`src/lab/types.ts`). The lab never looks inside the model, so a neural network, a genetic algorithm, a reinforcement learner or a physics simulation fit equally.

| Member | What it does |
| --- | --- |
| `id`, `version`, `title` | `version` goes up when older snapshots can no longer be restored; runs of another version are refused on import. |
| `defaults` | The configuration a new run starts with. |
| `milestones`, `maxSteps`, `historyEvery` | Rounds checkpointed by themselves, the last round, how often metrics go into the history. |
| `metricInfo` | Each metric's label (`en`, `tr`), format and whether lower or higher is better. |
| `init(config, rng)` | A new model. Draw every random number from `rng`. |
| `step(model, rng)` | One round: an epoch, a generation, a tick. Mutates the model. |
| `metrics(model)` | Numbers only. |
| `save(model)` / `restore(snapshot, config)` | A JSON-safe snapshot, and the model back from one. `restore` must throw on a snapshot that doesn't fit: imports rely on it. |
| `draw(ctx, model, w, h, palette)` | The picture. The canvas is 2D; a 3D experiment can draw with WebGL (adding a library such as three.js only then). |

Reproducibility: the random generator's whole state is one number, saved with every checkpoint, so a run continued from a checkpoint goes on exactly as before (`tests/lab.test.ts` checks it).

## Runs, storage and files

A run (`Run` in `src/lab/types.ts`) holds its seed, configuration, round, metric history, checkpoints and, when saved, the model as it is. Runs are kept in the browser (IndexedDB, `src/lab/store.ts`), saved at each checkpoint and on pause, and the latest one reopens with the page. The browser may clear that storage; *Export run* writes a JSON file (`format: "folio-lab-run"`, `formatVersion: 1`) that *Import a run* reads back, on any device. Imports are checked first: the format, the experiment and its version, every number, and that every snapshot restores; an import never replaces a run already there.

Training runs on the main thread, a few milliseconds per frame, so the page stays responsive; a heavier experiment can move `advance()` into a Web Worker without changing the rest. Nothing is drawn while a run is paused.

## How it is published

`folio.yaml` is the only setting:

```yaml
kind: lab
access: public            # lab apps must be public to be listed on Folio
name: my-lab            # optional: its address, my-lab.oztozlu.dev
title: { en: …, tr: … }  # English falls back to the repository name
summary: { en: …, tr: … }
order: 1                  # earlier on /lab; the rest newest first
embed: true               # false: Folio links to it instead of running it in the page
aspect: "16:10"           # the frame's shape on Folio (default 16:9)
inputs: [keyboard, touch, gamepad, mouse]   # shown on its Folio page
```

On every push to `main`, `.github/workflows/folio.yml` tests and builds it with no secrets at all and keeps `dist/` as the `folio-site` artifact. The controller (a GitHub App and its own workflow) reads `folio.yaml` from that commit, checks the build, deploys it to its own Cloudflare Worker at `https://<name>.oztozlu.dev`, checks it answers, and lists it in Folio's catalogue. A file that doesn't fit, or a failed build, leaves the last good version online. Delete `folio.yaml`, archive or delete the repository, and the controller takes it down and out of Folio.

**On Folio**, `/lab/<name>` runs it in a frame when the visitor asks, with *Full screen* and *Open in a new tab* (which also works without JavaScript). Folio adds `?folio=1&lang=en|tr&skin=graphite|paper|blueprint|terminal` to its address; `folioContext()` reads the language and the skin's colours, and `body.embedded` lets the lab app hide what Folio already shows. The frame allows its scripts, its own storage, full screen, downloads, file choosing and new tabs, and nothing of Folio itself; storage in the frame is kept apart from the lab app opened on its own.

**Who may frame it**: `public/_headers` sets `frame-ancestors` (Folio, its Preview, a local Folio), and the controller's Worker adds the same rule if a build drops it. The same file locks it to its own origin: no inline scripts, no third-party requests.

## Before publishing

- A run reaches its milestones, compares them, continues from a checkpoint, exports and imports.
- It is readable framed and alone, in each skin, at desktop and phone width.
- `pnpm test` and `pnpm build` pass; the *Folio* workflow is green.
