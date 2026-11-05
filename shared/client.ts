import type {
  Query,
  Pager,
  Entity,
  Device,
  Task,
  TaskCommand,
  Reading,
  Usage,
  Context,
  OwnerMeter,
  OwnerDetail,
  FileInfo
} from './types'
export interface Transport {
  get<T>(url: string): Promise<T>
  post<T>(url: string, body?: unknown): Promise<T>
  remove<T>(url: string): Promise<T>
  upload(file: File, projectId: string): Promise<FileInfo>
}
const prefix = '/property/facility-energy',
  id = encodeURIComponent
/** 所有业务请求共享当前SaaS会话和应用范围，不允许页面传入任意身份。 */
export function facilityClient(http: Transport) {
  return {
    query: <T extends Entity>(path: string, q: Query = {}, suffix = '') =>
      http.post<Pager<T>>(prefix + '/' + path + '/_query' + suffix, q),
    read: <T extends Entity>(path: string, key: string) => http.get<T>(prefix + '/' + path + '/' + id(key)),
    save: <T extends Entity>(path: string, row: unknown) => http.post<T>(prefix + '/' + path, row),
    remove: (path: string, row: Entity) =>
      http.remove<void>(prefix + '/' + path + '/' + id(row.id) + '?version=' + row.version),
    get: <T>(path: string) => http.get<T>(prefix + '/' + path),
    post: <T>(path: string, body?: unknown) => http.post<T>(prefix + '/' + path, body),
    devices: (q: Query) => http.post<Pager<Device>>(prefix + '/devices/_query', q),
    updateDevice: (row: Entity) => http.post<Device>(prefix + '/devices/' + id(row.id), row),
    sync: (project: string) => http.post<Entity>(prefix + '/devices/sync/' + id(project)),
    tasks: (q: Query, mine = false) => http.post<Pager<Task>>(prefix + '/tasks/_query?mine=' + mine, q),
    task: (key: string) => http.get<Task>(prefix + '/tasks/' + id(key)),
    action: (key: string, action: string, command: TaskCommand) =>
      http.post<Task>(prefix + '/tasks/' + id(key) + '/' + id(action), command),
    downloadTask: (key: string) => http.get<Task>(prefix + '/tasks/' + id(key) + '/offline'),
    context: () => http.get<Context>(prefix + '/context/me'),
    options: (kind: string) => http.get<Entity[]>(prefix + '/context/' + kind),
    series: (key: string, property: string, from: number, to: number) =>
      http.get<Reading[]>(
        prefix + '/energy/series/' + id(key) + '?property=' + id(property) + '&from=' + from + '&to=' + to
      ),
    usage: (key: string, property: string, from: number, to: number) =>
      http.get<Usage>(
        prefix + '/energy/usage/' + id(key) + '?property=' + id(property) + '&from=' + from + '&to=' + to
      ),
    meters: () => http.get<OwnerMeter[]>(prefix + '/owner/meters'),
    ownerDetail: (binding: string, from: number, to: number) =>
      http.get<OwnerDetail>(prefix + '/owner/meters/' + id(binding) + '?from=' + from + '&to=' + to),
    messages: () => http.get<Entity[]>(prefix + '/owner/messages'),
    upload: http.upload
  }
}
export type FacilityClient = ReturnType<typeof facilityClient>
