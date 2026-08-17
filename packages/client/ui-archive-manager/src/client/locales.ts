/**
 * `settings.archiveManager` namespace dictionaries: the 归档管理 settings
 * section's copy. Runtime failure messages (wire error strings) pass through
 * untranslated by policy.
 */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  nav: '归档管理',
  intro: '归档的会话已从工作区列表中隐藏，其会话记录仍然保留。按工作区查看，并将需要恢复的会话取消归档。',
  noArchived: '暂无归档会话',
  'group.ungrouped': '未分组',
  'sessions.count.one': '{n} 个会话',
  'sessions.count.other': '{n} 个会话',
  unarchive: '取消归档',
  unarchiveAria: '取消归档：{name}',
  'time.now': '刚刚',
  'time.minutes': '{n}分钟',
  'time.hours': '{n}小时',
  'time.days': '{n}天',
  'time.months': '{n}个月',
  'time.years': '{n}年',
  'time.ago': '{t}前',
} satisfies Record<string, string>

/** The archive-manager namespace key union. */
export type ArchiveManagerKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  nav: 'Archive manager',
  intro: 'Archived sessions are hidden from the workspace list while their session logs are kept. Review them by workspace and unarchive the ones to restore.',
  noArchived: 'No archived sessions',
  'group.ungrouped': 'Ungrouped',
  'sessions.count.one': '{n} session',
  'sessions.count.other': '{n} sessions',
  unarchive: 'Unarchive',
  unarchiveAria: 'Unarchive: {name}',
  'time.now': 'now',
  'time.minutes': '{n}min',
  'time.hours': '{n}h',
  'time.days': '{n}d',
  'time.months': '{n}mo',
  'time.years': '{n}y',
  'time.ago': '{t} ago',
} satisfies Record<ArchiveManagerKey, string>
