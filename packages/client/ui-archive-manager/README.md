# @deepseek-ai/dsh-client-ui-archive-manager

English | [中文](README.zh.md)

The archive-manager plugin: one settings section (`settings.section` id `archives`, ordered below the agent-presets page) that lists archived sessions and restores them.

Archiving is a display-set operation: the host moves a session id into the registry-global archive set, the session disappears from every grouping surface — workspace groups, the ungrouped bucket, content search, and the flat list — while its session log and its workspace accounting slot remain, so unarchiving restores the exact position it had. The section shows that hidden set: archived sessions appear grouped by workspace exactly like the unarchived browser tree (workspace registry order, accounting order within a group, and a trailing ungrouped bucket for archived sessions outside every workspace), and each row carries an unarchive action. The row leaves the section on the unary echo, and the sidebar picks it up again from the same archive-set snapshot — local echo and remote tab frames converge through the one `host/archived-sessions-changed` source.

Each group is collapsible like the sidebar's: the header row (chevron, workspace title, session count) toggles its rows, which render only while expanded, and groups start collapsed. Expansion lives in a declared viewing store persisted to localStorage (`dsh.archiveManager.expanded.v1`), so the state survives settings remounts and reloads; a group whose every session was unarchived drops its record so a later re-archive starts collapsed.

The section reads only the framework's global feeds (`useSessions` and `useWorkspaces`, the same snapshots the sidebar derives from) and the workspaces service's `unarchiveSession` RPC; the only store it owns is that viewing state, and it holds no Host state. Blank placeholders and subagent children are excluded exactly like the browser tree excludes them, so the archived view mirrors the unarchived one.

## Model Experience

None, as the section is browser chrome over an existing host RPC; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **No re-archive action in the section** — restoring happens from the workspace browser's row menu (Archive session), which is the same gesture that archived the session; the section deliberately offers only the direction that cannot be reached elsewhere.
- **The ungrouped bucket carries no workspace context** — an archived session outside every workspace (for example after a workspace registration deletion) shows its title only, like the browser's own ungrouped rows.
