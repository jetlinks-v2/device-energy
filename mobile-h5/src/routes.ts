/** 路由与离线预载共用同一加载函数，首次断网导航无需再请求页面模块。 */
export const routePages = {
  home: () => import('./views/HomePage.vue'),
  faults: () => import('./views/FaultListPage.vue'),
  fault: () => import('./views/FaultPage.vue'),
  faultRepair: () => import('./views/FaultRepairPage.vue'),
  tasks: () => import('./views/TaskListPage.vue'),
  scan: () => import('./views/ScanPage.vue'),
  sync: () => import('./views/SyncPage.vue'),
  profile: () => import('./views/ProfilePage.vue'),
  alert: () => import('./views/AlertPage.vue'),
  messages: () => import('./views/MessagesPage.vue'),
  login: () => import('./views/LoginPage.vue'),
  task: () => import('./views/TaskPage.vue'),
  group: () => import('./views/GroupPage.vue'),
  device: () => import('./views/DevicePage.vue')
}
export const offlineRoutePages = [routePages.home, routePages.tasks, routePages.task, routePages.scan, routePages.group, routePages.device, routePages.sync, routePages.profile]
export async function preloadOfflineRoutes(loaders: (() => Promise<unknown>)[] = offlineRoutePages) {
  await Promise.all(loaders.map(load => load()))
}
