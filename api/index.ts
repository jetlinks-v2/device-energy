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
  post<T>(url: string, data?: unknown): Promise<Response<T>>
  remove<T>(url: string): Promise<Response<T>>
}
const http = request as Http
const unwrap = <T>(r: Response<T>): T => {
  if (r.status !== 200 && !r.success) throw Error(r.message || feText('requestFailed'))
  return r.result
}
export const facility = facilityClient({
  get: async <T>(url: string) => unwrap(await http.get<T>(url)),
  post: async <T>(url: string, body?: unknown) => unwrap(await http.post<T>(url, body)),
  remove: async <T>(url: string) => unwrap(await http.remove<T>(url)),
  upload: async (file: File, projectId: string) => {
    const body = new FormData()
    body.append('file', file)
    return unwrap(await http.post('/file/facility/upload?projectId=' + encodeURIComponent(projectId), body))
  }
})

export const downloadFile = async (id: string): Promise<Blob> => {
  const response = await request.get('/file/' + encodeURIComponent(id), {}, { responseType: 'blob' })
  return (response instanceof Blob ? response : response.data) as Blob
}
