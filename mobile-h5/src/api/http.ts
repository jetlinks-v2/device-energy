import { feLocale, feText } from '../../../shared/i18n'
import { clearSession, state } from '../services/session'
export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: { type?: string; key?: string }
  ) {
    super(message)
  }
}
/** 统一携带当前标签页的 SaaS 会话；登录请求显式跳过业务上下文。 */
export async function request<T>(
  path: string,
  body?: unknown,
  method = body === undefined ? 'GET' : 'POST',
  scoped = true,
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  const headers: Record<string, string> = { 'Accept-Language': feLocale(), ...extraHeaders }
  const session = state.session
  if (scoped && session) {
    headers['X-Access-Token'] = session.token
    headers['X-Tenant-Domain'] = session.tenantDomain
    headers['X-Asset-Scope'] = 'business_application:' + session.applicationId
  }
  const multipart = body instanceof FormData
  if (body !== undefined && !multipart) headers['Content-Type'] = 'application/json'
  const response = await fetch(state.config.apiBase + path, {
    method,
    headers,
    body: body === undefined ? undefined : multipart ? (body as FormData) : JSON.stringify(body),
    signal: AbortSignal.timeout(60000)
  })
  const data = (await response.json()) as { status?: number; message?: string; result: T }
  const status = data.status || response.status
  if (!response.ok || status !== 200) {
    if (scoped && status === 401) {
      clearSession()
      window.dispatchEvent(new Event('facility:session-expired'))
    }
    throw new ApiError(data.message || feText('requestFailed'), status, data.result as { type?: string; key?: string })
  }
  return data.result
}
export const errorText = (e: unknown) => (e instanceof Error ? e.message : feText('operationFailedPleaseTryAgain'))
