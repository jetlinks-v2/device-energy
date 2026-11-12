import { feText } from '../../../shared/i18n'
import { request } from './http'
import { state } from '../services/session'
import { facilityClient } from '../../../shared/client'
import type { Authorization, FileInfo } from '../../../shared/types'
export const authorize = () => request<Authorization>('/authorize/me')
export const facility = facilityClient({
  get: <T>(url: string) => request<T>(url),
  post: <T>(url: string, body?: unknown) => request<T>(url, body, 'POST'),
  remove: <T>(url: string) => request<T>(url, undefined, 'DELETE'),
  upload: (file: File, projectId: string) => {
    const body = new FormData()
    body.append('file', file)
    return request<FileInfo>('/file/facility/upload?projectId=' + encodeURIComponent(projectId), body)
  }
})

/** Authenticated file reads bypass the public service-worker cache. */
export async function downloadFile(id: string): Promise<Blob> {
  const session = state.session
  if (!session) throw Error(feText('signInFirst'))
  const response = await fetch(state.config.apiBase + '/file/' + encodeURIComponent(id), {
    headers: {
      'X-Access-Token': session.token,
      'X-Tenant-Domain': session.tenantDomain,
      'X-Asset-Scope': 'business_application:' + session.applicationId
    },
    signal: AbortSignal.timeout(60000)
  })
  if (!response.ok) throw Error(feText('attachmentIsUnavailable'))
  const blob = await response.blob()
  if (blob.size > 20 * 1024 * 1024) throw Error(feText('thisInstructionAttachmentExceeds20MbViewItOnline'))
  return blob
}
