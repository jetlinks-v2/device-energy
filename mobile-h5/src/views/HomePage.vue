<script setup lang="ts">
import { reactive, computed } from 'vue'
import { canFault } from '../hooks/useFaultWork'
import { state, can, canMessage } from '../services/session'
import { useWorkspace } from '../hooks/useWorkspace'
import { m } from '../services/mobileText'
import TaskRow from '../components/TaskRow.vue'
import OfflineModeControl from '../components/OfflineModeControl.vue'
const vm = reactive(useWorkspace())
const entries = computed(() => [
  { name: m('工单池', 'Task pool'), icon: 'logistics', to: '/tasks?mode=pool', color: 'sky', visible: can('query') },
  { name: m('巡检任务', 'Inspection'), icon: 'shield-o', to: '/tasks?kind=inspection', color: 'blue', visible: can('query') },
  { name: m('维保任务', 'Maintenance'), icon: 'setting-o', to: '/tasks?kind=maintenance', color: 'teal', visible: can('query') },
  { name: '消息', icon: 'bell', to: '/messages', color: 'sky', visible: canMessage() },
  { name: '维修任务', icon: 'setting-o', to: '/faults', color: 'orange', visible: canFault('query') },
  { name: m('任务转派', 'Dispatch'), icon: 'exchange', to: '/tasks?mode=dispatch&status=active', color: 'orange', visible: can('dispatch') },
  { name: m('我的审批', 'Reviews'), icon: 'todo-list-o', to: '/tasks?mode=review', color: 'blue', visible: can('review') }
].filter(e => e.visible))
</script>
<template>
  <main class="page home-page">
    <div class="welcome"><strong>{{ state.context?.userName || state.authorization?.user.name }}</strong><router-link to="/scan" class="scan-button" :aria-label="m('扫码查看设备', 'Scan a device')"><van-icon name="scan" /></router-link></div>
    <MobileNotice v-if="vm.error" type="error" show-icon :message="vm.error"><template #action><van-button class="mobile-text-button" plain @click="vm.refresh">{{ m('重试', 'Retry') }}</van-button></template></MobileNotice>
    <MobileNotice v-if="!vm.online" type="warning" :message="state.offlineMode ? '离线模式已开启，检查结果保存在本机' : '当前无网络，请先联网开启离线模式'" />
    <template v-if="can('query')">
      <div class="work-summary">
        <router-link to="/tasks?status=active"><strong>{{ vm.counts[0] ?? '—' }}</strong><span>{{ m('我的待办', 'To do') }}</span></router-link>
        <router-link to="/tasks?status=overdue"><strong class="warning-number">{{ vm.counts[1] ?? '—' }}</strong><span>{{ m('已超期', 'Overdue') }}</span></router-link>
        <router-link v-if="can('review')" to="/tasks?mode=review"><strong>{{ vm.counts[2] ?? '—' }}</strong><span>{{ m('待我审批', 'To review') }}</span></router-link>
      </div>
    </template>
      <nav class="quick-entries" :aria-label="m('常用功能', 'Quick access')"><router-link v-for="entry in entries" :key="entry.to" :to="entry.to"><span class="entry-icon" :class="entry.color"><van-icon :name="entry.icon" /></span><span>{{ entry.name }}</span></router-link><OfflineModeControl v-if="can('save')" entry /></nav>
    <template v-if="can('query')">
      <router-link v-if="vm.pending" class="sync-banner" to="/sync"><van-icon name="exchange" /><span>{{ vm.pending }}{{ m(' 条记录等待同步', ' records to sync') }}</span><van-icon name="arrow" /></router-link>
      <div class="section-heading"><h2>{{ vm.online ? m('待处理任务', 'Tasks to do') : m('本机任务', 'Cached tasks') }}</h2><router-link to="/tasks">{{ m('全部', 'All') }}<van-icon name="arrow" /></router-link></div>
      <div class="task-list"><TaskRow v-for="task in vm.tasks" :key="task.id" :task="task" /></div>
      <van-loading v-if="vm.busy" class="loading" /><van-empty v-else-if="!vm.tasks.length && !vm.error" :description="m('暂无待处理任务', 'No tasks to do')" />
    </template>
  </main>
</template>
