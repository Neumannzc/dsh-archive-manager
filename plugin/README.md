# @tangzai/dsh-ui-archive-manager

A beautified **archive manager** settings section for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh): a flat list of archived sessions grouped by workspace, each row with a hover **unarchive** button, folder-style group headers, and relative timestamps (中文/English).

The package is a **dual-half plugin**: the node half restores the unarchive capability on stock npm dsh (the official `0.1.0-rc.6` ships `archiveSession` but **not** `unarchiveSession` — it was briefly published upstream then rolled back), and the browser half renders the settings section. No core packages are modified.

## How it works

- **Display**: the section reads the framework's own feeds — `useSessions` (archived sessions stay in `session.list`) and `useWorkspaces` (`WorkspaceListState.archivedSessionIds`) — so no custom data plumbing is needed.
- **Unarchive action**: the browser half POSTs to the plugin's own exact HTTP route on the official `webServer` carrier; the node half patches `WorkspaceRegistry.unarchiveSession` (idempotent — a future official release that adds the method wins) and applies the same durable, queue-serialized state update as the upstream implementation. The change then propagates to every client through the core `archived-sessions-changed` frame.

## Features

- **设置 → 归档管理** settings page (same `archives` section id as the official plugin).
- Archived sessions grouped by workspace, mirroring the sidebar grouping rules.
- Beautified UI: flat session rows, folder group headers, relative timestamps (`3min ago` / `3分钟前`), hover-only unarchive icon button.
- Trust fence on the unarchive route: loopback or same-origin only; cross-site requests refused.

## Install

Requires dsh `>= 0.1.0-rc.6` (archived-session feeds and the `webServer` carrier exist there) and `pnpm`.

```bash
dsh plugin --profile web add @tangzai/dsh-ui-archive-manager
```

Then restart the dsh profile (the plugin row mounts at next boot). Open **设置 → 归档管理** to see archived sessions and unarchive them.

> Note: if your profile also runs the official `@deepseek-ai/dsh-client-ui-archive-manager` row, both sections render. Prefer one of them (either remove the official row, or uninstall this package).

## Compatibility

| dsh version | status |
| --- | --- |
| `>= 0.1.0-rc.6` (npm) | supported — unarchive provided by this plugin's node half |
| `< 0.1.0-rc.6` | not supported (no archived-session feeds / webServer carrier) |

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
