# Agent Note：归档管理设置页

Status: implemented

[English](2026-08-15-archive-manager-settings-section.md) | 中文

在[会话归档（注册表全局集）](../feature/2026-07-31-session-archive-global-set.md)决策之上补充恢复方向与管理表面；归档决策本身不变。

## 问题

产品中的会话归档是单向的。`workspace.archiveSession` 将会话 id 移入注册表全局归档集后，会话便从所有分组表面消失，但没有任何表面可以查看归档集，也没有任何操作可以恢复会话——注册表自己的 README 把取消归档描述为“未来的 unarchive 将恢复其位置”。误归档的用户没有恢复途径。

## 决策

**取消归档是一等注册表操作。** `WorkspaceRegistry.unarchiveSession(sessionId)` 将 id 从持久归档集中移除；已不在集合中的 id 直接返回、不写盘。它刻意不校验会话存在性：集合中的 id 必然通过过 `archiveSession` 的存在性检查，而消失的 id 对分组表面本来就不可见。由于归档从不触碰工作区记账，取消归档无需重新挂载即可恢复会话的原位置。`domain/changed` 监听器本就在任何归档集写入时推送 `host/archived-sessions-changed`，因此单向 RPC 回显加帧即可让所有标签页保持一致，无需改动事件。

**线协议镜像 `archiveSession`。** `workspace.unarchiveSession` 接收 `{ sessionId }` 并返回完整更新集合，经同一套 rpc-map / schema / fetch 传输注册。客户端 workspaces 服务（`IWorkspaces.unarchiveSession`）与归档孪生一样把回显集合安装进共享快照 store。

**归档视图由新的设置页拥有。** `ui-archive-manager` 注册 `settings.section` id `archives`，order 25——排在 agent 预设页之下——标签为“归档管理”。该页从侧边栏读取的同一框架数据源（`useSessions` + `useWorkspaces`）派生行，按工作区分组显示归档会话，与未归档树完全一致：工作区注册表顺序、组内记账顺序、尾部未分组桶，以及浏览器自身的可见性规则（排除空白占位与子代理子会话）。每一行带一个取消归档操作，调用 workspaces 服务；行在单向回显时离开该页，侧边栏从同一快照重新拾取。该页不拥有 store，也不拥有任何宿主状态——数据与操作在运行时中均已存在。

## 备选方案

**由设置页直接写 domain global。** 否决：注册表在内存中缓存 `WorkspaceDomainState`，带外写入会让注册表下一次变更读到过期状态，从而重新归档或覆盖集合。

**只把取消归档暴露为模型工具。** 否决：需求是一个面向用户的管理表面，且行菜单的“归档会话”已拥有归档方向；该页刻意只提供别处无法到达的方向。

**复用工作区浏览器树并加“包含归档”开关。** 否决：浏览器行携带对隐藏历史无意义的实时状态控件，而一个增量设置页可以在不扰动浏览表面不变量的前提下展示归档集。

## 影响

归档会话现在可以通过 设置 → 归档管理 恢复，归档集由不透明变为可见。单向 RPC 加既有变更帧让本地与远端标签页无需新的事件管道即可收敛。`archives` 页的 order（25）位于 agent 预设页（20）之下、`better-sidebar` 演示行（100）之上；部署如需重排设置页，自行重写各自的 order 值。e2e（`apps/web/tests/archive-manager.e2e.ts`）零模型调用地走完完整回路——adopt 工作区、从行菜单归档两个带标题的种子会话、在设置页中按工作区分组查看、取消归档其一、验证跨刷新持久性、取消归档其余至空状态。
