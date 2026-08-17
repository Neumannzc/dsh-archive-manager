# dsh-archive-manager — 归档管理（显示归档会话 + 取消归档）

DeepSeek Harness（dsh）的一次功能开发交付：在 **设置 → 归档管理** 页面按工作区展示已归档会话，并支持取消归档。

## 功能

- **设置入口**：设置面板新增「归档管理」页，位于 [通用设置] → [模型] → [插件] → [Agent 预设] 之下（`settings.section` id `archives`，order 25）。
- **按工作区分组显示归档会话**：与未归档的侧边栏树同一套派生规则——工作区注册表顺序、组内记账顺序、尾部「未分组」桶、排除空白占位与子代理子会话。
- **取消归档**：每行一个「取消归档」按钮，恢复后会话立即回到侧边栏原分组位置。
- **持久性**：归档集存储在 workspace domain 全局状态，取消归档跨重启保持；多标签页通过既有 `host/archived-sessions-changed` 帧同步。

## 目录结构

按仓库相对路径排列（`CHANGES.patch` 为已跟踪文件的完整 diff，新增文件已包含在目录中）：

```
packages/workspace/workspace/src/index.ts        Host: WorkspaceRegistry.unarchiveSession
packages/workspace/workspace/tests/workspace.spec.ts
packages/host/apiproxy/src/                      API 网关: workspace.unarchiveSession RPC（接口/schema/rpc-map/处理/传输）
packages/host/apiproxy/tests/
packages/client/runtime/src/client/workspaces/   Client runtime: workspaces.unarchiveSession 服务
packages/client/runtime/tests/
packages/client/connection/src/client/fixture.ts 循环回放 fixture
packages/test-support/client-runtime/src/workspaces.ts
packages/client/ui-archive-manager/              新插件包：归档管理设置页（apply/locales/derive/组件/测试/README）
packages/bundle/web-app/cordis.patch.yml         dsh.client 注册行
packages/bundle/web-app/package.json             bundle 依赖
apps/web/tests/archive-manager.e2e.ts            e2e：新建会话→归档→设置页显示→取消归档→reload 持久性
apps/web/tests/snapshots/*.expected.md           因新增导航行 refresh 的设置页 golden
.agents/notes/implemented/feature/2026-08-15-archive-manager-settings-section.md  Agent Note（含中文）
tsconfig.base.json / tsconfig.client.json / tsconfig.host.json / apps/web/tsconfig.json  装配面
```

## 验证

- 单元：`pnpm run test:gui`（277 文件 / 3774 测试全绿）
- e2e（零模型调用）：`DSH_E2E_ARCHIVE_WORKSPACE=/home/tang/workspace/tmp pnpm run test:web:built`（该文件独立运行亦可：`pnpm exec vitest run --config vitest.web.config.ts apps/web/tests/archive-manager.e2e.ts`）
- 其余门禁：knip / publint / constraints / package-invariants / node-next-types / runtime-closure / verify-cordis-config 均通过

## 已知的环境噪音（与本改动无关）

- `hmr-live` e2e：本机 chromium 默认中文 locale，测试硬编码英文 hero 文案，预先存在。
- `rescope-vendor` 门禁：26 个未触碰文件上的既有残留。
- `/home/tang/project/person/dsh-archive-manager` 仅含源码，不含 node_modules / lib 构建产物。
