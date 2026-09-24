import { api } from '../../lib/api'
import { useSession } from '../../store/session'
import { createSettingsResource } from './resource'

export const backupTargetsResource = createSettingsResource(async () => (await api.backup.targets()).targets)
export const backupRunsResource = createSettingsResource(async () => (await api.backup.runs()).runs)
export const mcpResource = createSettingsResource(() => api.mcp.get())
export const statsResource = createSettingsResource(() => api.settings.stats())
export const totpResource = createSettingsResource(() => api.auth.totp.status())

const resources = [backupTargetsResource, backupRunsResource, mcpResource, statsResource, totpResource]
useSession.subscribe((state, previous) => {
  if (state.user?.id !== previous.user?.id || (state.status === 'anonymous' && previous.status !== 'anonymous')) {
    resources.forEach((resource) => resource.clear())
  }
})
