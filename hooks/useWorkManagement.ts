import { ref } from 'vue'
import { feText } from '../shared/i18n'

/** 配置与执行留在同一类型工作区，成功生成后直接查看任务。 */
export function useWorkManagement() {
  const activeTab = ref('tasks')
  const tabs = [
    { resource: 'tasks', label: feText('task') },
    { resource: 'standards', label: feText('workStandard') },
    { resource: 'cycles', label: feText('cyclePlan') },
    { resource: 'plans', label: feText('taskConfiguration') },
    { resource: 'groups', label: feText('equipmentRoomGroups') }
  ]
  const showTasks = () => { activeTab.value = 'tasks' }
  return { activeTab, tabs, showTasks }
}
