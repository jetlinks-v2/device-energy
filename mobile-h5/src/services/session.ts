import { feText } from '../../../shared/i18n'
import { reactive } from 'vue'
import type { Context } from '../../../shared/types'
import { randomId } from '../utils/randomId'
import { clearTaskScanAccess } from './taskScanAccess'
import type { Authorization, RuntimeConfig, Session } from '../types'

export const state = reactive<{
  config: RuntimeConfig
  session?: Session
  authorization?: Authorization
  projectId?: string
  context?: Context
  ready: boolean
  offlineMode: boolean
  offlineBusy: boolean
}>({
  config: { applicationId: '', tenantDomain: '', title: feText('facilityAndEnergyManagement'), allowedHostOrigins: [], apiBase: '/api' },
  ready: false, offlineMode: false, offlineBusy: false
})
const KEY = 'facility-h5:session'
export async function initializeConfig() {
  const response = await fetch(`${import.meta.env.BASE_URL}config.json`, { cache: 'no-store' })
  if (!response.ok) throw Error(feText('unableToLoadApplicationConfiguration'))
  state.config = (await response.json()) as RuntimeConfig
  if (!state.config.apiBase.startsWith('/') || state.config.apiBase.startsWith('//'))
    throw Error(feText('theApiMustUseASameOriginPath'))
  try {
    const stored = JSON.parse(sessionStorage.getItem(KEY) || 'null') as Session | null
    if (
      stored?.token &&
      stored.applicationId === state.config.applicationId &&
      stored.tenantDomain === state.config.tenantDomain
    )
      state.session = stored
  } catch {
    sessionStorage.removeItem(KEY)
  }
}
export function setSession(session: Session) {
  clearTaskScanAccess()
  state.authorization = undefined
  state.projectId = undefined
  state.offlineMode = false
  state.context = undefined
  state.session = session
  sessionStorage.setItem(KEY, JSON.stringify(session))
}
export function clearSession() {
  clearTaskScanAccess()
  sessionStorage.removeItem('facility:verified:' + state.session?.tenantDomain + ':' + state.session?.applicationId)
  state.session = undefined
  state.authorization = undefined
  state.projectId = undefined
  state.offlineMode = false
  state.context = undefined
  sessionStorage.removeItem(KEY)
}
export const can = (action: string) =>
  !!state.authorization?.permissions.find((p) => p.id === 'facility-task')?.actions.includes(action)

export const canMessage = () => !!state.authorization?.permissions.find(p => p.id === 'facility-message')?.actions.includes('query')
export const canWorkspace = () => !!state.authorization?.permissions.some(p => ['facility-task', 'facility-fault', 'facility-message'].includes(p.id) && p.actions.includes('query'))

/** 仅受信宿主可交接会话；业务身份和应用授权随后必须通过真实后端核验。 */
export function attachHostBridge(onSession: () => Promise<void>) {
  const nonce = randomId()
  const receive = async (event: MessageEvent) => {
    if (
      !state.config.allowedHostOrigins.includes(event.origin) ||
      event.source !== window.parent ||
      window.parent === window
    )
      return
    const data = event.data as { type?: string; nonce?: string; session?: Session }
    if (data?.type !== 'jetlinks.facility.session' || data.nonce !== nonce || !data.session) return
    const s = data.session
    if (
      typeof s.token !== 'string' ||
      !s.token ||
      s.applicationId !== state.config.applicationId ||
      s.tenantDomain !== state.config.tenantDomain
    )
      return
    setSession(s)
    await onSession()
  }
  window.addEventListener('message', receive)
  if (window.parent !== window)
    for (const origin of state.config.allowedHostOrigins)
      window.parent.postMessage(
        { type: 'jetlinks.facility.ready', nonce, applicationId: state.config.applicationId },
        origin
      )
  return () => window.removeEventListener('message', receive)
}
