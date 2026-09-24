import { t } from '../../lib/i18n'

export function SettingsLoading({ label = t('common.loading'), rows = 4 }: { label?: string; rows?: number }) {
  return (
    <div role="status" aria-live="polite" aria-label={label} className="space-y-4 py-3">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className="motion-safe:animate-pulse space-y-4">
        {Array.from({ length: rows }, (_, row) => (
          <div key={row} className="flex min-h-16 items-center justify-between gap-6 border-b border-[var(--border-subtle)] pb-4">
            <div className="flex-1 space-y-2">
              <div className="h-3 w-24 rounded bg-[var(--bg-hover)]" />
              <div className="h-2.5 w-3/4 rounded bg-[var(--bg-hover)]" />
            </div>
            <div className="h-8 w-20 rounded-[var(--r-md)] bg-[var(--bg-hover)]" />
          </div>
        ))}
      </div>
    </div>
  )
}
