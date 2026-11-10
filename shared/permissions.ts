/** 使用宿主菜单按钮权限；服务端继续校验操作及资产权限。 */
export function resourcePermission(resource: string, kind?: string, action = 'configure'): string | string[] | boolean {
  if (['standards', 'cycles', 'plans', 'groups', 'tasks'].includes(resource)) {
    const menus = kind === 'maintenance' ? ['Maintenance'] : kind === 'inspection' ? ['Inspection'] : ['Inspection', 'Maintenance']
    const page = resource[0].toUpperCase() + resource.slice(1)
    const button = action === 'configure' ? 'save' : action
    return menus.map(menu => `facility/${menu}/${page}:${button}`)
  }
  if (resource === 'devices') return 'facility/Devices:save'
  if (['energy/mappings', 'readings', 'replacements'].includes(resource)) return action === 'toggle' ? 'facility/Energy:toggle' : 'facility/Energy:save'
  if (resource === 'faults') return 'facility/Faults:save'
  if (resource === 'rules') return action === 'toggle' ? 'facility/Alerts:toggle' : 'facility/Alerts:rules'
  if (['alerts', 'planAlerts'].includes(resource)) return 'facility/Alerts:handle'
  if (['notifications', 'planNotifications'].includes(resource)) return 'facility/Notifications:retry'
  if (resource === 'targets') return 'facility/Reports:save'
  return false
}
