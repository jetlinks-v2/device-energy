import { feText } from '../shared/i18n'
import { request } from '@jetlinks-web/core'
import { facilityClient } from '../shared/client'
interface Response<T> {
  success?: boolean
  status?: number
  result: T
  message?: string
}
interface Http {
  get<T>(url: string): Promise<Response<T>>
  post<T>(url: string, data?: unknown, options?: { signal?: AbortSignal; timeout?: number }): Promise<Response<T>>
  remove<T>(url: string): Promise<Response<T>>
}
const http = request as Http
const unwrap = <T>(r: Response<T>): T => {
  if (r.status !== 200 && !r.success) throw Error(r.message || feText('requestFailed'))
  return r.result
}
export const facility = facilityClient({
  get: async <T>(url: string) => unwrap(await http.get<T>(url)),
  // 历史补采包含云端分页；只延长该操作，普通列表继续使用宿主默认超时。
  post: async <T>(url: string, body?: unknown) => unwrap(await http.post<T>(url, body,
    url.startsWith('/property/facility-energy/energy/collect/') ? { timeout: 60_000 } : undefined)),
  remove: async <T>(url: string) => unwrap(await http.remove<T>(url)),
  upload: async (file: File, projectId: string) => {
    const body = new FormData()
    body.append('file', file)
    return unwrap(await http.post('/file/facility/upload?projectId=' + encodeURIComponent(projectId), body))
  }
})

/** 平台表格拥有请求生命周期，取消信号继续传给宿主 HTTP 客户端。 */
export const queryResource = async (path: string, query: import('../shared/types').Query, signal?: AbortSignal) =>
  unwrap(await http.post<import('../shared/types').Pager<import('../shared/types').Entity>>(
    '/property/facility-energy/' + path + '/_query', query, { signal }
  ))

export const downloadFile = async (id: string): Promise<Blob> => {
  const response = await request.get('/file/' + encodeURIComponent(id), {}, { responseType: 'blob' })
  return (response instanceof Blob ? response : response.data) as Blob
}
