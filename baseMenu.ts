import menus from './baseMenu.json'
type Menu = { children?: Menu[]; [key: string]: unknown }

// 公共基础菜单由宿主统一加载；聚合菜单不绑定独立前端应用。
const prepare = (items: Menu[]): Menu[] => items.map(item => ({
  ...item,
  runtime: true,
  children: item.children ? prepare(item.children) : undefined
}))
export default () => prepare(menus)
