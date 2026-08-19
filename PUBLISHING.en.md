# Publishing guide (English)

> Mirror of `PUBLISHING.md` (Chinese) for international maintainers. The
> Chinese file is the source of truth for any procedural nuance; this file
> tracks the same workflow in English.

Goal: let other people **install** the archive-manager plugin
> (`dsh plugin --profile web add @tangzai/dsh-ui-archive-manager`) and
> **find it** (npm search / GitHub).

## Background

The official npm dsh (`0.1.0-rc.6`) ships `archiveSession` but **not**
`unarchiveSession` — the unarchive method was briefly published then rolled
back upstream. This plugin is therefore a **dual-half** package:

- the **node half** patches `WorkspaceRegistry.unarchiveSession` and
  registers an HTTP route on the official `webServer` carrier (the same
  channel `dsh-client-connection`'s `/api` bridge uses);
- the **browser half** renders the beautified settings page (display
  reads the official `useSessions` / `archivedSessionIds` feeds; actions
  go through the plugin's own route).

Zero core changes: the plugin only uses services dsh already exposes
(`workspaceRegistry`, `webServer`, `archived-sessions-changed` frames).

## Package layout (`plugin/`)

```
plugin/
├── package.json          # dsh.bundle.patch + dsh.client declaration, exports["./client"], keywords
├── .npmrc                # @tangzai scope publishes via the official registry (see "Registry")
├── cordis.patch.yml      # insert row (id: ui-archive-manager-beautified)
├── tsconfig.json         # node half (src/index.ts host impl, src/invariant.ts → lib/)
├── tsconfig.client.json  # client type declarations (→ lib/types/client/)
├── tsdown.config.ts      # client bundle (__ModuleLoader__.load protocol + inline CSS Modules)
├── src/                  # source: node half (unarchive patch + HTTP route), browser half (beautified settings page)
├── LICENSE               # MIT (upstream DeepSeek copyright preserved alongside this project's)
├── README.md             # install guide
├── vitest.config.ts      # pure-function test config (derivation + locales)
└── tests/                # vitest suites for derive.ts / relativeTime / locale completeness
```

Key fields:

| Field | Purpose |
| --- | --- |
| `name: "@tangzai/..."` | scope package name (`tangzai` = npm account; publish requires `npm login` as that account) |
| `dsh.bundle.patch` | `dsh plugin add` uses this to attach the bundle to the profile layer list |
| `dsh.client` | client manifest; `platform` must be `"web"` |
| `exports["./client"]` | hard requirement for `dsh-client-modules` to scan the browser bundle |
| `cordis.patch.yml` | top-level `- insert:` row adding the plugin (`name` must equal the package name) |
| `peerDependencies` | only declares `react`; all `@deepseek-ai/*` live in `devDependencies` (profile tree resolves runtime deps, avoiding ERESOLVE — same pattern as `dsh-web-ui`) |
| `scripts.prepare` | auto-builds on git URL installs (`dsh plugin add link:` / `git+https`) |
| `keywords` + `description` | npm search index source |

## Release steps

Prerequisites: Node.js ≥ 20 and pnpm installed; npm account `tangzai` is
`npm login`-ed.

### Registry: local mirror vs official

The machine's `~/.npmrc` defaults to `https://registry.npmmirror.com/`
(read-only mirror, can't publish). `plugin/.npmrc` adds a scope-level
override so `@tangzai/*` publishes via the official registry while
routine installs keep using the mirror:

```ini
# plugin/.npmrc
@tangzai:registry=https://registry.npmjs.org/
```

The official-registry auth token
(`//registry.npmjs.org/:_authToken=...`) is configured in `~/.npmrc`.
Verify before publishing (tokens can expire):

```bash
# Confirm scope points at the official registry
npm config get @tangzai:registry      # expect https://registry.npmjs.org/

# Check connectivity and auth (401 = expired token, re-login)
npm ping --registry https://registry.npmjs.org/
npm whoami --registry https://registry.npmjs.org/    # expect tangzai
```

Expired token: `npm login --registry https://registry.npmjs.org/`
(**must include the official-registry flag**, otherwise the token gets
written under the mirror scope and publishing 401s).

### Publish commands

```bash
# 1. Install deps (plugin/ is independent of the monorepo, no pnpm-workspace.yaml interference)
cd plugin
pnpm install

# 2. Build + typecheck + tests (emits lib/index.js, lib/invariant.js, lib/types/**, lib/client.js)
pnpm run build
pnpm run typecheck
pnpm run test

# 3. Pre-publish inspection (npm pack contents preview; --dry-run doesn't publish,
#    can be run against the mirror)
pnpm pack --dry-run
#    Confirm includes: lib/, cordis.patch.yml, README.md, LICENSE

# 4. Publish (scope packages must --access public; plugin/.npmrc ensures the official registry)
npm publish --access public     # or pnpm publish --access public

# 5. Post-publish verification (visible on the official registry)
npm view @tangzai/dsh-ui-archive-manager version
```

Post-publish self-test (on a test profile, or directly on the web profile):

```bash
dsh plugin --profile web add @tangzai/dsh-ui-archive-manager
# restart the profile → 设置 → 归档管理
```

> **New version installed but appears to be an older one?** pnpm 11+'s
> `minimumReleaseAge` gates versions < 10 days old from being selected.
> Workaround: set `minimumReleaseAge: 0` in the profile's
> `pnpm-workspace.yaml`, or add `@tangzai/*` to
> `minimumReleaseAgeExclude`, then
> `dsh plugin --profile web update @tangzai/dsh-ui-archive-manager`.
> Same pitfall as `dsh-web-ui` [issue #71](https://github.com/zhu1090093659/dsh-web-ui/issues/71).

## Maximising "findability"

npm side (already configured in `package.json`, takes effect on publish):

- package name `@tangzai/dsh-ui-archive-manager` includes `dsh` + `archive` keywords;
- `description` first sentence includes "DeepSeek Harness (dsh)" + feature words;
- `keywords` cover `dsh / deepseek-harness / plugin / archive / unarchive / 归档`.

GitHub side (repo `Neumannzc/dsh-archive-manager`):

- repo About: `A beautified archive manager plugin for DeepSeek Harness (dsh)`;
- Topics: `dsh`, `deepseek-harness`, `plugin`, `archive-manager`, `typescript`;
- README has bilingual feature and install sections (root README can link to `plugin/README.md` at the top).

Other channels (optional):

- dsh official repo Discussions announcement;
- third-party plugin rosters (e.g. `docs/plugins.md` of `dsh-web-ui`);
- community plugin directories (none built-in as of `rc.6`).

### dshfind.com / awesome-dsh-plugin listing (done)

Submitted to
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
(dshfind.com's data source), discoverable at
https://dshfind.com/zh/plugins:

- submission: `data/plugins/Neumannzc__dsh-archive-manager.yml`
  (this repo has a copy at `docs/awesome-dsh-plugin.yml`);
- workflow: local clone → add YAML → `node scripts/generate-readme.mjs` to
  regenerate README → fork + PR;
- **CI gates**: repo age ≥ 1 day, GitHub commits ≥ 10, `package.json`
  declares `dsh.bundle`, repo carries `dsh-plugin` topic. Failing any of
  these auto-rejects; resubmit after fixing.

## Maintenance strategy

- **Upstream sync**: when the official version moves from `rc.6` to `rc.7+`,
  relax/upgrade the `^0.1.0-rc.6` pins in `devDependencies`, re-diff the
  official `dsh-client-ui-archive-manager` source, and merge upstream fixes
  back into this package's source.
- **Version cadence**: in the `0.x` phase use `pnpm version patch/minor`;
  after publishing, tag with `pnpm version`.
- **Scope name**: `@tangzai` is your npm account, naturally exclusive; no
  need to rush a non-scope name before someone else grabs it.

## Future: aggregation-package pattern (if more plugins land)

A single plugin doesn't need an aggregation package. If new plugins
(skins, panels, etc.) arrive, follow the `dsh-web-ui` pattern:

1. One npm package per feature plugin (`@tangzai/dsh-xxx`), each with its
   own `cordis.patch.yml` and `dsh.bundle.patch`;
2. Aggregation package `@tangzai/dsh-web-ui-all` (or similar):
   `dependencies` all use `workspace:*` to reference feature packages,
   `cordis.patch.yml` writes one `- insert:` per feature package (row ids
   use independent namespace prefixes);
3. Publish **must use `pnpm publish`** (it auto-rewrites `workspace:*` to
   real version numbers; `npm publish` doesn't), in dependency order:
   feature packages first, then the aggregator.

## Alternate path (not pursued, may revisit)

- **Upstream PR**: the beautification delta is only three files; a PR to
  `deepseek-ai/deepseek-harness` would ship the changes to every dsh
  upgrade without maintaining a separate package. Can run in parallel with
  this package.