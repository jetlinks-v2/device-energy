import type { MenuFilterDefinition } from '@jetlinks-web-core/types/module'
import { isProjectApplicationScope } from '@jetlinks-web-core/utils/application-scope'

export const FACILITY_ROOT_MENU_CODE = 'facility-management'

/** 独立应用展开已授权的设施分组；项目入口保留完整的系统授权树。 */
export const facilityMenuFilter: MenuFilterDefinition = {
  code: 'facility-application-navigation',
  filter(menus, { applicationScope }) {
    if (!applicationScope?.trim() || isProjectApplicationScope(applicationScope)) return menus

    return menus.flatMap(menu => menu.code === FACILITY_ROOT_MENU_CODE ? menu.children || [] : [menu])
  }
}
