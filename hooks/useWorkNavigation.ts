import { useRouter } from 'vue-router'

/** 成功生成后进入同类型任务菜单；未授权的菜单没有路由，不主动跳转。 */
export function useWorkNavigation(kind: 'inspection' | 'maintenance') {
  const router = useRouter()
  const showTasks = () => {
    const path = `/facility/${kind}/tasks`
    if (router.resolve(path).matched.some(route => route.path === path)) return router.push(path)
  }
  return { showTasks }
}
