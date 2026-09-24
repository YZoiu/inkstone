import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSettingsResource } from './resource'

afterEach(() => vi.useRealTimers())

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}

describe('settings resource cache', () => {
  it('deduplicates prefetch and page requests, reuses fresh data, and refreshes stale data without blanking it', async () => {
    vi.useFakeTimers()
    const first = deferred<number>()
    const second = deferred<number>()
    const fetcher = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const resource = createSettingsResource<number>(fetcher)
    const preload = resource.load()
    expect(resource.load()).toBe(preload)
    first.resolve(1)
    await preload
    expect(await resource.load()).toBe(1)
    expect(fetcher).toHaveBeenCalledOnce()
    vi.advanceTimersByTime(30_001)
    const refresh = resource.load()
    expect(resource.peek()).toBe(1)
    second.resolve(2)
    await refresh
    expect(resource.peek()).toBe(2)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('retains cached content after a failed refresh and permits retry', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(1).mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce(2)
    const resource = createSettingsResource<number>(fetcher)
    await resource.load()
    await expect(resource.load(true)).rejects.toThrow('Offline')
    expect(resource.peek()).toBe(1)
    await resource.load(true)
    expect(resource.peek()).toBe(2)
  })

  it('does not allow an older fetch to overwrite a saved change', async () => {
    const response = deferred<number>()
    const resource = createSettingsResource(() => response.promise)
    const pending = resource.load()
    resource.set(2)
    response.resolve(1)
    await pending
    expect(resource.peek()).toBe(2)
  })

  it('forces a post-mutation refresh past an older in-flight prefetch', async () => {
    const old = deferred<number>()
    const updated = deferred<number>()
    const fetcher = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(updated.promise)
    const resource = createSettingsResource<number>(fetcher)
    const preload = resource.load()
    const refresh = resource.load(true)
    expect(refresh).not.toBe(preload)
    updated.resolve(2)
    await refresh
    old.resolve(1)
    await preload
    expect(resource.peek()).toBe(2)
  })

  it('clears account data and ignores an old account request finishing after a new one', async () => {
    const oldAccount = deferred<number>()
    const newAccount = deferred<number>()
    const fetcher = vi.fn().mockReturnValueOnce(oldAccount.promise).mockReturnValueOnce(newAccount.promise)
    const resource = createSettingsResource<number>(fetcher)
    resource.set(1)
    const oldRequest = resource.load(true)
    await Promise.resolve()
    resource.clear()
    expect(resource.peek()).toBeNull()
    const newRequest = resource.load()
    newAccount.resolve(3)
    await newRequest
    oldAccount.resolve(2)
    await oldRequest
    expect(resource.peek()).toBe(3)
  })
})
