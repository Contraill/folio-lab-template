# Folio lab template

A starting point for experiments with learning systems and simulations that show up on [Folio](https://oztozlu.dev/lab) by themselves. The lab gives every experiment the same bench: run and pause, rounds counted, metrics recorded, checkpoints at fixed rounds (100, 500 and 1000 by default) and at will, side-by-side comparison of checkpoints, continuing from any checkpoint, runs kept in the browser, and runs as files to keep or share.

The pilot, **Two Spirals**, is a small neural network (2 → 24 → 24 → 1, written out in plain TypeScript) learning to tell two spirals apart. At round 100 it is still guessing, at 500 it has the shape, at 1000 it is sure of it.

## Start an experiment

1. **Use this template** on GitHub to create a new public repository.
2. Rename it in three places: `name` in `package.json`, `name` in `wrangler.jsonc` and the `<title>` in `index.html`.
3. Write your experiment in `src/experiments/` (below) and import it in `src/main.ts` instead of the spirals.
4. Fill in `.github/folio.yaml`, deploy, set the repository's **homepage** to the app's address and add the **`folio-lab`** topic. Folio lists it at its next build (at most six hours, or at once with *Run workflow* on Folio's Production workflow).

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

## How Folio shows it

`/lab` lists every public repository of the owner with the `folio-lab` topic and an https homepage, with a page per app, `/lab/<repository-name>`, that runs it in a frame when the visitor asks, with *Full screen* and *Open in a new tab*.

`.github/folio.yaml` (every field optional): `title` and `summary` as `{ en, tr }`, `order`, `embed` (`false` links instead of framing), `embedOptions.aspect` (like `"16:10"`) and `embedOptions.input`. A file that doesn't fit leaves only this app out of Folio, with a warning in Folio's build log.

**In the frame**, Folio adds `?folio=1&lang=en|tr&skin=…`; `src/lab/folio.ts` reads the language and the skin's colours. The frame allows the app's scripts, its own storage, downloads (exports), file choosing (imports), full screen and new tabs, and nothing of Folio itself. Runs saved in the frame are kept apart from runs saved with the app opened on its own: export one to move it.

**Who may frame the app** is set in `public/_headers` (`frame-ancestors`), which also locks it to its own origin.

## Deploy

As in the play template: static files served by Cloudflare (`wrangler.jsonc`), deployed by `.github/workflows/deploy.yml` on every push to `main`. Once per repository: a Cloudflare API token with **Account · Workers Scripts · Edit**, and a GitHub environment `production` limited to `main` with `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

## Before adding the `folio-lab` topic

- A run reaches its milestones, compares them, continues from a checkpoint, exports and imports.
- It is readable framed and alone, in each skin, at desktop and phone width.
- `pnpm test` and `pnpm build` pass.
