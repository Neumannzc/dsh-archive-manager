# dsh-archive-manager

A beautified **archive manager** plugin for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (dsh): a **设置 → 归档管理** settings page listing archived sessions grouped by workspace, each row with a hover **unarchive** action and relative timestamps.

[![npm version](https://img.shields.io/npm/v/@tangzai/dsh-ui-archive-manager.svg)](https://www.npmjs.com/package/@tangzai/dsh-ui-archive-manager)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**中文简介**：为 DeepSeek Harness（dsh）的 Web 界面提供美化版归档管理设置页——按工作区分组展示已归档会话，悬停取消归档，附相对时间。官方 npm 版 dsh（`0.1.0-rc.6`）只含 `archiveSession`（`unarchiveSession` 曾被短暂发布后回滚），本插件的 node half 自带取消归档实现，无需改动 dsh 核心。

## Features

- **设置 → 归档管理** settings page (plugin-scoped id `archives-beautified`, distinct from any official `archives` id).
- Archived sessions grouped by workspace, mirroring the sidebar grouping rules.
- Beautified UI: flat session rows, folder group headers, relative timestamps (`3min ago` / `3分钟前`), hover-only unarchive icon button.
- **Self-contained unarchive**: the plugin's node half patches `WorkspaceRegistry.unarchiveSession` when the official release lacks it (idempotent — a future official method wins) and exposes it to the browser over the official `webServer` carrier; state changes propagate to every tab through the core `archived-sessions-changed` frame.
- Trust fence on the unarchive route: mirrors `client-connection`'s `isTrustedApiRequest` — DNS-rebinding defense via a mandatory `Host` fence, cross-site refused, opaque `Origin: null` refused, LAN deployments add their bound authority to the `trustedHosts` list; plus an 8 KiB body-size cap with two-layer defense (Content-Length precheck + streaming byte count).

## Install

Requires dsh `>= 0.1.0-rc.6` and `pnpm`.

```bash
dsh plugin --profile web add @tangzai/dsh-ui-archive-manager
```

Restart the dsh profile, then open **设置 → 归档管理**.

> If your profile also runs the official `@deepseek-ai/dsh-client-ui-archive-manager` row, both sections render — prefer one of them.

## Compatibility

| dsh version | status |
| --- | --- |
| `>= 0.1.0-rc.6` (npm) | supported — unarchive provided by the plugin's node half |
| `< 0.1.0-rc.6` | not supported |

## Repository layout

| path | what |
| --- | --- |
| `plugin/` | The published npm package ([`@tangzai/dsh-ui-archive-manager`](https://www.npmjs.com/package/@tangzai/dsh-ui-archive-manager)): node half (`src/index.ts`), browser half (`src/client/`), build config, `cordis.patch.yml` |
| `PUBLISHING.md` / `PUBLISHING.en.md` | Publish / npm-search / maintenance guide (中文 source of truth, English mirror) |
| `packages/` … `apps/` | The upstream dsh monorepo snapshot this feature was developed in (the archive-manager settings section, incl. `workspace.unarchiveSession` core work, later rolled back upstream) |

## Development

```bash
cd plugin
pnpm install
pnpm run build       # tsc node half + client type declarations + tsdown client bundle
pnpm run typecheck   # tsc on node half, client half, and tests
pnpm run test        # vitest: derive / relativeTime / locale completeness
```

## License

MIT — see [LICENSE](./LICENSE). Derived from [deepseek-ai/deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (MIT, © DeepSeek).
