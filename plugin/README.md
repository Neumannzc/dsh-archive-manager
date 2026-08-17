# @tangzai/dsh-ui-archive-manager

A beautified **archive manager** settings section for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh): a flat list of archived sessions grouped by workspace, each row with a hover **unarchive** button, folder-style group headers, and relative timestamps.

Built on the official `@deepseek-ai/dsh-client-ui-archive-manager` feature (dsh ≥ `0.1.0-rc.6`); this package restyles it and adds relative-time labels (中文/English).

## Features

- **设置 → 归档管理** settings page (same `archives` section id as the official plugin).
- Archived sessions grouped by workspace, mirroring the sidebar grouping rules.
- Beautified UI: flat session rows, folder group headers, relative timestamps (`3min ago` / `3分钟前`), hover-only unarchive icon button.
- Works entirely client-side: reads the framework `useSessions`/`useWorkspaces` feeds and calls the core `workspaces.unarchiveSession` service — no host-side logic, no core patches.

## Install

Requires dsh `>= 0.1.0-rc.6` (the core `workspace.unarchiveSession` RPC landed there) and `pnpm`.

```bash
dsh plugin --profile web add @tangzai/dsh-ui-archive-manager
```

Then restart the dsh profile (the plugin row mounts at next boot). Open **设置 → 归档管理** to see archived sessions and unarchive them.

> Note: if your profile also runs the official `@deepseek-ai/dsh-client-ui-archive-manager` row, both sections render. Prefer one of them (either remove the official row, or uninstall this package).

## Compatibility

| dsh version | status |
| --- | --- |
| `>= 0.1.0-rc.6` | supported |
| `< 0.1.0-rc.6` | not supported (no core unarchive RPC) |

## Development

```bash
pnpm install
pnpm run build     # tsc node half + client type declarations + tsdown client bundle
pnpm run typecheck
```

## Publish (maintainers)

```bash
pnpm publish --access public
```

The package declares `dsh.bundle.patch`, so `dsh plugin add` automatically joins it to the profile's bundle layers and mounts `cordis.patch.yml` (row id `ui-archive-manager-beautified`).

## License

MIT — see [LICENSE](./LICENSE). Derived from [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (MIT, © DeepSeek).
