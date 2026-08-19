/**
 * The 归档管理 settings section: archived sessions grouped by Workspace
 * exactly like the unarchived browser tree, each group collapsible like the
 * sidebar's (header row toggles; rows render only while expanded) and each
 * row with an unarchive action. The view derives from the same framework
 * feeds the sidebar reads (useSessions + useWorkspaces), so an archive or
 * unarchive echo — local or from another tab — moves both surfaces together;
 * expansion state lives in the declared viewing store, persisted across
 * remounts and reloads.
 */

import { useEffect, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import {
  IconFolderClose16, IconFolderOpen16, IconRefreshOutline16,
  IconTriangleRightFill14, Tooltip,
} from '@deepseek-ai/dsh-client-ui-primitives'
import type { InjectFace, PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import type { createArchiveViewStore } from './view-store.ts'
import { deriveArchivedGroups, relativeTime, UNGROUPED_KEY, type ArchivedGroupNode } from './derive.ts'
import type { ArchiveManagerKey } from './locales.ts'
import css from './ArchiveManagerSection.module.css'

/** Registration-side business face for the archive-manager section. */
export interface ArchiveManagerSectionInjected {
  /** Remove one session from the registry-global archive set. */
  unarchive: (sessionId: SessionId) => Promise<void>
}

/** Full component props. */
export type ArchiveManagerSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settingsArchiveManager'>
  & PropsStore<ReturnType<typeof createArchiveViewStore>>
  & InjectFace<ArchiveManagerSectionInjected>

/** Localized compact relative time label. */
function timeLabel(updatedAt: number, now: number, t: (key: ArchiveManagerKey, params?: Record<string, string | number>) => string): string {
  const { unit, n } = relativeTime(updatedAt, now)
  return unit === 'now' ? t('time.now') : t('time.ago', { t: t(`time.${unit}`, { n }) })
}

/**
 * Render one workspace group: the collapsible header row and, while expanded,
 * the archived session rows.
 * @param props - group node, expanded bit, and the localized affordances.
 * @returns the group element tree.
 */
function Group({ group, expanded, onToggle, t, unarchive }: {
  group: ArchivedGroupNode
  expanded: boolean
  onToggle: () => void
  t: (key: ArchiveManagerKey, params?: Record<string, string | number>) => string
  unarchive: (sessionId: SessionId) => Promise<void>
}): ReactNode {
  const countKey = group.sessions.length === 1 ? 'sessions.count.one' : 'sessions.count.other'
  return (
    <section className={css.group} data-archive-group={group.key}>
      <button
        type="button"
        className={css.groupHead}
        aria-expanded={expanded}
        onClick={onToggle}
      >
        <span className={css.folder}>
          {expanded ? <IconFolderOpen16 /> : <IconFolderClose16 />}
        </span>
        <span className={css.arrow}>
          <IconTriangleRightFill14 className={expanded ? css.arrowOpen : undefined} />
        </span>
        <span className={css.groupTitle}>{group.label}</span>
        <span className={css.groupCount}>{t(countKey, { n: group.sessions.length })}</span>
      </button>
      {expanded && (
        <ul className={css.rows}>
          {group.sessions.map(session => (
            <ArchiveRow
              key={String(session.id)}
              session={session}
              t={t}
              unarchive={unarchive}
            />
          ))}
        </ul>
      )}
    </section>
  )
}

/**
 * One archived session row: title, relative time, and a hover-only unarchive
 * icon button matching the sidebar session row spec.
 */
function ArchiveRow({ session, t, unarchive }: {
  session: ArchivedGroupNode['sessions'][number]
  t: (key: ArchiveManagerKey, params?: Record<string, string | number>) => string
  unarchive: (sessionId: SessionId) => Promise<void>
}): ReactNode {
  const now = Date.now()
  const label = timeLabel(session.updatedAt, now, t)
  return (
    <li className={css.row}>
      <span className={css.rowTitle}>{session.title}</span>
      <span className={css.time}>{label}</span>
      <span className={css.rowActions}>
        <Tooltip label={t('unarchive')} side="bottom" delayMs={300}>
          <button
            type="button"
            className={css.iconButton}
            aria-label={t('unarchiveAria', { name: session.title })}
            onClick={() => { void unarchive(session.id) }}
          >
            <IconRefreshOutline16 />
          </button>
        </Tooltip>
      </span>
    </li>
  )
}

/**
 * Render the archive-manager section content column.
 * @param props - composed slot props.
 * @returns the section, or the empty state when nothing is archived.
 */
export function ArchiveManagerSection(props: ArchiveManagerSectionProps): ReactNode {
  const { t, unarchive, useStore, actions } = props
  const sessions = props.useSessions(s => s)
  const workspaces = props.useWorkspaces(s => s)
  const groups = useMemo(
    () => deriveArchivedGroups(
      sessions,
      workspaces.items,
      workspaces.archivedSessionIds,
      t('group.ungrouped'),
    ),
    [sessions, workspaces, t],
  )
  const groupExpansion = useStore(s => s.groupExpansion)

  // Groups that no longer exist (every session unarchived) leave the
  // persisted expansion record behind; drop them so a later re-archive of the
  // same workspace starts collapsed instead of inheriting a stale open state.
  useEffect(() => {
    actions.retainGroupKeys(groups.map(group => group.key))
  }, [actions, groups])

  return (
    <div className={css.section}>
      <h2 className={css.title}>{t('nav')}</h2>
      <p className={css.intro}>{t('intro')}</p>
      {groups.length === 0
        ? <p className={css.empty}>{t('noArchived')}</p>
        : groups.map(group => (
          <Group
            key={group.key === UNGROUPED_KEY ? 'ungrouped' : group.key}
            group={group}
            expanded={groupExpansion[group.key] === true}
            onToggle={() => { actions.setGroupExpanded(group.key, groupExpansion[group.key] !== true) }}
            t={t}
            unarchive={unarchive}
          />
        ))}
    </div>
  )
}
