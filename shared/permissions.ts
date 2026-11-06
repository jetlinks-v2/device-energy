/** 使用宿主菜单按钮权限；服务端继续校验操作及资产权限。 */
export function resourcePermission(resource: string, kind?: string, action = 'configure'): string | string[] | boolean {
  if (['standards', 'plans', 'groups', 'tasks'].includes(resource)) {
    const menus = kind === 'maintenance' ? ['Maintenance'] : kind === 'inspection' ? ['Inspection'] : ['Inspection', 'Maintenance']
    return menus.map(menu => `facility/${menu}:${action}`)
  }
  if (resource === 'devices') return 'facility/Devices:save'
  if (['energy/mappings', 'readings', 'replacements'].includes(resource)) return 'facility/Energy:save'
  if (resource === 'faults') return 'facility/Faults:save'
  if (resource === 'rules') return 'facility/Alerts:rules'
  if (['alerts', 'planAlerts'].includes(resource)) return 'facility/Alerts:handle'
  if (['notifications', 'planNotifications'].includes(resource)) return 'facility/Notifications:retry'
  if (resource === 'targets') return 'facility/Reports:save'
  return false
}
