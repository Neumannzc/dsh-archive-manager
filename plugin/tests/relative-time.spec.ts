/**
 * Relative-time bucketing tests. The function is intentionally pure
 * (injected `now`) so the renderer can hand in a stable clock — and so a
 * test can pin every bucket boundary without time mocking.
 */
import { describe, expect, it } from 'vitest'
import { relativeTime } from '../src/client/derive.ts'

describe('relativeTime', () => {
  it('buckets current, minute, hour, day, month, and year distances', () => {
    const now = 400 * 24 * 60 * 60 * 1_000
    expect(relativeTime(now, now)).toEqual({ unit: 'now', n: 0 })
    expect(relativeTime(now - 5 * 60_000, now)).toEqual({ unit: 'minutes', n: 5 })
    expect(relativeTime(now - 3 * 3_600_000, now)).toEqual({ unit: 'hours', n: 3 })
    expect(relativeTime(now - 2 * 86_400_000, now)).toEqual({ unit: 'days', n: 2 })
    expect(relativeTime(now - 60 * 86_400_000, now)).toEqual({ unit: 'months', n: 2 })
    expect(relativeTime(0, now)).toEqual({ unit: 'years', n: 1 })
  })

  it('stays in the now bucket under one minute', () => {
    const now = 1_000_000
    expect(relativeTime(now - 59_999, now)).toEqual({ unit: 'now', n: 0 })
  })

  it('moves to minutes exactly at the one-minute boundary', () => {
    const now = 1_000_000
    expect(relativeTime(now - 60_000, now)).toEqual({ unit: 'minutes', n: 1 })
  })

  it('clamps future timestamps to the now bucket (a clock skew between the session and the renderer should never show a negative distance)', () => {
    const now = 1_000_000
    expect(relativeTime(now + 5_000, now)).toEqual({ unit: 'now', n: 0 })
  })
})