# Folio lab template

A starting point for experiments with learning systems and simulations that appear on [Folio](https://oztozlu.dev/lab) by themselves. The lab gives every experiment the same bench: run and pause, rounds, checkpoints at milestones, metrics, side-by-side comparison of checkpoints, runs kept on the device, and export and import as a file. Push to `main` and the experiment is served by Folio itself at `https://oztozlu.dev/lab/<name>/app/`, with its own page at `/lab/<name>`.

The sample, **Two Spirals**, is a small neural network (2 → 24 → 24 → 1, written out in plain TypeScript) learning to tell two spirals apart. At round 100 it is still guessing, at 500 it has the shape, at 1000 it is sure.

There are three Folio templates; pick by what you are making:

| Template | Makes | Lives at | Who can open it |
| --- | --- | --- | --- |
| `folio-play-template` | a game | `oztozlu.dev/play/<name>`, part of Folio | everyone |
| `folio-lab-template` (this one) | an experiment or simulation | `oztozlu.dev/lab/<name>`, part of Folio | everyone |
| `folio-site-template` | a separate site | `<name>.oztozlu.dev` | everyone, people you name, or whoever has a password; optional protected admin area |

## Start an experiment

1. **Use this template** on GitHub and name the repository. The name, in lower case, becomes its place in Folio (`/lab/<name>`) unless `site.yaml` sets `name`. The repository may be public or private; the experiment itself is always public.
2. Rename it in `package.json` and in the `<title>` of `index.html`, write the experiment in `src/experiments/` (below), import it in `src/main.ts` instead of the spirals, and fill in `site.yaml`.
3. Push to `main`.

That is all. No secrets, topics, DNS records or Cloudflare settings, and nothing to change in the Folio repository. The first commit made by *Use this template* is picked up by itself.

```sh
pnpm install
pnpm dev        # http://localhost:5173
pnpm test       # the runner, files and the sample's learning, in Node
pnpm build      # type check, then dist/ (relative paths, so it runs from any folder)
```

Requires Node 26 (`.node-version`) and pnpm 12.

## What happens after a push

1. `.github/workflows/folio.yml` installs, tests and builds the experiment with no secrets at all, and keeps `dist/` as the `folio-site` artifact (14 days).
2. The Folio controller (a GitHub App and its own workflow, in the private `folio-controller` repository) hears the build finish. It reads `site.yaml` **from the same commit as the build**, checks the files (below), packs them, keeps them by their SHA-256, and adds the experiment to Folio's catalogue with that hash.
3. The controller starts Folio's build. Folio downloads the experiment, accepts it only if the hash and size match, and serves it from its own Worker at `/lab/<name>/app/`.

A push is usually live on the Folio Preview within about five minutes. Production gets it the same way once Folio is live there (see *Implemented, deferred, limits*).

**If something goes wrong**, the last good version stays where it is:

- a failed test or build: nothing is published; the next push tries again;
- a build the controller refuses: the repository is marked as failing on the controller's status page and in its run log, with the reason, and the controller tries again after 10, 20, 40, 80 and 160 minutes (a new commit starts over);
- Folio can't fetch or verify the build: that one experiment is left out of Folio's build, with a warning, and everything else is published.

**Going back**: revert the commit and push; the controller publishes the reverted build like any other.

## site.yaml

The only setting. Every field but `kind` is optional.

```yaml
kind: lab                   # lab; or play, or site (see the table above)
name: my-experiment         # its place in Folio, /lab/my-experiment. Default: the repository's name in lower case
title: { en: Two Spirals, tr: İki Sarmal }   # default: the repository's name
summary: { en: …, tr: … }                    # default: empty
order: 1                    # earlier on /lab than apps without one; the rest newest first
embed: true                 # default true; false: Folio links to it instead of running it in its page
aspect: "16:10"             # the frame's shape, width:height. Default 16:9
inputs: [mouse, touch, keyboard]             # shown on its card: keyboard, touch, mouse, gamepad
```

An experiment is always public: `access` may only be `public`, and `allow`, `deny`, `serviceTokens`, `login` and `admin` don't apply. For a protected site use `folio-site-template`.

`folio.yaml` is the old name of this file and is still read; a repository with **both** files is refused (the controller changes nothing) until one is removed.

### Names

- Lower-case letters, digits and hyphens, 1 to 63 characters, not starting or ending with a hyphen.
- First come, first served among lab apps: if another repository already has `/lab/<name>`, the deploy fails with `/lab/<name> belongs to another repository`. Games and lab apps are separate places.
- Changing `name` moves the experiment: the next Folio build serves it at the new path; the old address answers 404 (no redirect), and runs saved under the old name stay under it (see *Runs*).

## On Folio

`/lab` lists the experiments of the current Folio build. `/lab/<name>` is its page: title and summary in the visitor's language (English when there is no Turkish), inputs, and the experiment, which **loads only when the visitor asks**, with *Full screen* and *Open in a new tab* (a plain link too, so it works without JavaScript).

Folio adds `?folio=1&lang=en|tr&skin=graphite|paper|blueprint|terminal` to its address: `folioContext()` (`src/lab/folio.ts`) gives the visitor's language and their skin's colours, and sets `body.embedded`; opened alone, it follows the browser's language and the system's light or dark setting.

The experiment is Folio's own files, so it shares Folio's origin (`oztozlu.dev`):

- **Runs** are the same in the frame and in its own tab. The database is named after the app's place in Folio (`lab:<name>:runs`, from `namespace()`), so two lab apps never share one.
- **Frame**: `sandbox="allow-scripts allow-same-origin allow-pointer-lock allow-downloads allow-popups allow-popups-to-escape-sandbox"` (downloads are what *Export run* needs), with `allow="fullscreen; gamepad; autoplay; clipboard-write"`. Because the app has Folio's origin, the sandbox is **not a security boundary**; it is acceptable only because every app is the owner's own repository, built by its own workflow and checked by the controller. Treat an experiment's dependencies as part of Folio.
- **Policy** that Folio sends with every file: `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; media-src 'self' data: blob:; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'none'; frame-ancestors 'self'`. No third-party requests (a model or dataset must be part of the build); WebAssembly and Web Workers are allowed; its pages carry `noindex`.
- **Files**: `index.html` without caching; files with a content hash in their name for a year; an address without an extension that isn't a file gets the app's page with a `<base>`; `/lab/<name>/app` redirects to `/lab/<name>/app/`.

### Taking it down

Delete `site.yaml`, archive the repository or delete it. The controller removes it from the catalogue and starts Folio's build, which no longer has it. Runs visitors saved stay in their own browsers until they clear them.

## What the controller accepts

- `index.html` at the root of `dist/`;
- no Worker code (`_worker.js`), no links, no paths leaving `dist/`;
- at most 5 000 files, 25 MiB per file, 100 MiB in all, and **20 MiB once packed** for Folio (files are base64-encoded, so about 15 MiB of files): a large model or dataset doesn't fit;
- `_headers` and `_redirects` are dropped: Folio sets the headers.

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

Training runs on the main thread, a few milliseconds per frame, so the page stays responsive; a heavier experiment can move `advance()` into a Web Worker without changing the rest. Nothing is drawn while a run is paused. `vite.config.ts` sets `base: './'`: keep it, as Folio serves the app from a folder.

## Before publishing

- A run reaches its milestones, compares them, continues from a checkpoint, exports and imports.
- It is readable framed and alone, in each skin, at desktop and phone width.
- `pnpm test` and `pnpm build` pass; the *Folio* workflow is green.

## Implemented, deferred, limits

| | Status |
| --- | --- |
| Push → build → checked → served by Folio at `/lab/<name>/app/` | Implemented; the same path as games, tested end to end on the Folio Preview |
| Catalogue entry, page, frame, full screen, new tab, runs per app in IndexedDB, export and import | Implemented |
| Removal by deleting `site.yaml`, archiving or deleting the repository | Implemented; tested |
| Publishing to production `oztozlu.dev` | Waits for Folio's go-live, when the controller also starts Folio's production workflow (`FOLIO_TARGETS`) |
| Server code (training on a server, an API) | Not supported: an experiment is static files running in the browser |
| A protected experiment (sign-in or password) | Not supported; use `folio-site-template` |
| Isolation from Folio's page | Limited: same origin, so the sandbox is not a boundary |
