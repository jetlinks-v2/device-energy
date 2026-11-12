import type {
  Query,
  Pager,
  Entity,
  Device,
  Task,
  TaskCommand,
  TaskAssignee,
  TaskProcess,
  Reading,
  Usage,
  Context,
  OwnerMeter,
  OwnerDetail,
  FileInfo,
  TaskMessage
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
    tasks: (q: Query, mine = false, pool = false) => http.post<Pager<Task>>(prefix + '/tasks/_query?mine=' + mine + '&pool=' + pool, q),
    taskReviews: (q: Query, status: 'pending' | 'approved' | 'rejected' | 'all' = 'pending') =>
      http.post<Pager<Task>>(prefix + '/tasks/review/_query?status=' + status, q),
    taskAssignees: (key: string) => http.get<TaskAssignee[]>(prefix + '/tasks/' + id(key) + '/assignees'),
    canClaimTask: (key: string) => http.get<boolean>(prefix + '/tasks/' + id(key) + '/claimable'),
    taskHistory: (key: string, pageIndex = 0) => http.get<Pager<TaskProcess>>(prefix + '/tasks/' + id(key) + '/history?pageIndex=' + pageIndex),
    task: (key: string) => http.get<Task>(prefix + '/tasks/' + id(key)),
    taskDevices: (key: string) => http.get<Task[]>(prefix + '/tasks/' + id(key) + '/devices'),
    relatedTasks: (q: Query) => http.post<Pager<Task>>(prefix + '/tasks/related/_query', q),
    action: (key: string, action: string, command: TaskCommand) =>
      http.post<Task>(prefix + '/tasks/' + id(key) + '/' + id(action), command),
    downloadTask: (key: string) => http.get<Task>(prefix + '/tasks/' + id(key) + '/offline'),
    context: () => http.get<Context>(prefix + '/context/me'),
    fault: (key: string) => http.get<import('./faults').Fault>(prefix + '/faults/' + id(key)),
    faultAction: (key: string, action: string, command: import('./faults').FaultCommand) =>
      http.post<import('./faults').Fault>(prefix + '/faults/' + id(key) + '/' + id(action), command),
    faultHistory: (key: string, pageIndex = 0) => http.get<Pager<TaskProcess>>(prefix + '/faults/' + id(key) + '/history?pageIndex=' + pageIndex),
    options: <T = Entity>(kind: string) => http.get<T[]>(prefix + '/context/' + kind),
    manualReading: (deviceId: string, input: { propertyId: string; value: string; observedTime: number; reason: string }) =>
      http.post<Reading>(prefix + '/energy/readings/' + id(deviceId), input),
    reviewReading: (row: Reading, approve: boolean) =>
      http.post<Reading>(prefix + '/energy/readings/' + id(row.id) + '/review', { version: row.version, approve }),
    resubmitReading: (row: Reading, input: { propertyId: string; value: string; observedTime: number; reason: string }) =>
      http.post<Reading>(prefix + '/energy/readings/' + id(row.id) + '/resubmit?version=' + row.version, input),
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
    taskMessages: (q: Query) => http.post<Pager<TaskMessage>>(prefix + '/messages/_query', q),
    unreadMessages: (projectId: string) => http.get<number>(prefix + '/messages/unread?projectId=' + id(projectId)),
    readMessage: (key: string) => http.post<void>(prefix + '/messages/' + id(key) + '/read'),
    readAllMessages: (projectId: string) => http.post<void>(prefix + '/messages/read-all?projectId=' + id(projectId)),
    messages: () => http.get<Entity[]>(prefix + '/owner/messages'),
    upload: http.upload
  }
}
export type FacilityClient = ReturnType<typeof facilityClient>
