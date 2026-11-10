import type { CardTone } from '@jetlinks-web-core/components/CardBox/types'

export const connectionStatusTones: Record<string, CardTone> = {
  online: 'success', offline: 'default', notActive: 'warning'
}
export const syncStatusTones: Record<string, CardTone> = {
  active: 'success', inactive: 'default', 'pending-project': 'warning', 'source-unavailable': 'error'
}
