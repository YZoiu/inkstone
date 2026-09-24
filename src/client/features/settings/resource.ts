import { useMemo, useSyncExternalStore, type SetStateAction } from 'react'

export function createSettingsResource<T>(fetcher: () => Promise<T>, ttl = 30_000) {
  let value: T | null = null
  let updatedAt = -Infinity
  let scope = 0
  let revision = 0
  let pending: Promise<T> | null = null
  const listeners = new Set<() => void>()
  const notify = () => listeners.forEach((listener) => listener())
  return {
    scope: () => scope,
    peek: () => value,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    set(next: SetStateAction<T | null>) {
      revision++
      pending = null
      value = typeof next === 'function' ? (next as (current: T | null) => T | null)(value) : next
      updatedAt = Date.now()
      notify()
    },
    invalidate() {
      revision++
      pending = null
      updatedAt = -Infinity
    },
    clear() {
      scope++
      revision++
      pending = null
      value = null
      updatedAt = -Infinity
      notify()
    },
    load(force = false): Promise<T> {
      if (!force && value !== null && Date.now() - updatedAt < ttl) return Promise.resolve(value)
      if (pending && !force) return pending
      const requestRevision = ++revision
      const task = Promise.resolve().then(fetcher).then((result) => {
        if (revision === requestRevision) {
          value = result
          updatedAt = Date.now()
          notify()
        }
        return result
      }).finally(() => {
        if (pending === task) pending = null
      })
      pending = task
      return task
    },
  }
}

export function useSettingsResource<T>(resource: ReturnType<typeof createSettingsResource<T>>) {
  const value = useSyncExternalStore(resource.subscribe, resource.peek, resource.peek)
  const scope = resource.scope()
  const setValue = useMemo(() => (next: SetStateAction<T | null>) => {
    if (resource.scope() === scope) resource.set(next)
  }, [resource, scope])
  return [value, setValue] as const
}
