/**
 * Locale dictionary completeness tests. The `en` dictionary's
 * `satisfies Record<ArchiveManagerKey, string>` already enforces key parity
 * against the `zh` source of truth at compile time; these tests assert the
 * same invariant at runtime so a misplaced `satisfies` edit or a key
 * deletion cannot slip past `tsc`.
 */
import { describe, expect, it } from 'vitest'
import { en, zh, type ArchiveManagerKey } from '../src/client/locales.ts'

describe('archive-manager locales', () => {
  it('exposes the same key set in zh and en', () => {
    const zhKeys = Object.keys(zh).sort()
    const enKeys = Object.keys(en).sort()
    expect(enKeys).toEqual(zhKeys)
  })

  it('keeps the plural count templates paired under sessions.count.{one,other}', () => {
    const oneKey: ArchiveManagerKey = 'sessions.count.one'
    const otherKey: ArchiveManagerKey = 'sessions.count.other'
    // Both keys must exist (compiles via `satisfies`), and the en values
    // must use the same {n} placeholder so a renderer call with
    // { n: count } works for both branches.
    expect(en[oneKey]).toContain('{n}')
    expect(en[otherKey]).toContain('{n}')
  })

  it('keeps every time bucket under time.* present in both dictionaries', () => {
    const buckets: ArchiveManagerKey[] = [
      'time.now', 'time.minutes', 'time.hours', 'time.days', 'time.months', 'time.years', 'time.ago',
    ]
    for (const key of buckets) {
      expect(zh[key]).toBeTruthy()
      expect(en[key]).toBeTruthy()
    }
  })
})