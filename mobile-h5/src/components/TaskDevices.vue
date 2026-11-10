<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { RightOutlined, ScanOutlined, CheckCircleFilled, AppstoreOutlined } from '@ant-design/icons-vue'
import type { Task } from '../../../shared/types'
import { useTaskDevices } from '../hooks/useTaskDevices'
import { state, can } from '../services/session'
import { taskScanAllowed } from '../services/taskScanAccess'
const props = defineProps<{ task: Task }>()
const vm = reactive(useTaskDevices(() => props.task))
const route = useRoute()
const scannable = computed(() => can('save') && props.task.assigneeId === state.context?.userId && ['claimed', 'executing', 'rectify'].includes(props.task.state))
function target(row: Task) {
  const path = '/tasks/' + encodeURIComponent(row.id)
  return vm.groupId && row.groupIds?.includes(vm.groupId) && taskScanAllowed(state.context, row, route.query.scan, vm.groupId)
    ? { path, query: { scan: route.query.scan, groupId: vm.groupId } } : path
}
</script>
<template>
  <section class="task-devices">
    <div class="section-heading"><h2><AppstoreOutlined />{{ vm.groupId ? '设备组检查' : '设备清单' }}</h2><div class="device-progress"><span>已提交 {{ task.submittedDeviceCount || 0 }} / {{ task.deviceCount }}</span><router-link v-if="scannable" class="scan-icon" :to="'/scan?taskId=' + encodeURIComponent(task.id)" aria-label="扫描设备组二维码" title="扫描设备组二维码"><ScanOutlined /></router-link></div></div>
    <div v-if="vm.groupId" class="group-filter"><span>当前设备组 · {{ vm.visible.length }}台设备</span><router-link :to="'/tasks/' + task.id">查看全部</router-link></div>
    <a-alert v-if="vm.error" type="error" :message="vm.error"><template #action><a-button type="link" @click="vm.load">重试</a-button></template></a-alert>
    <a-spin v-if="vm.busy" class="loading" />
    <router-link v-for="row in vm.visible" :key="row.id" class="device-task" :to="target(row)">
      <div class="device-task-title"><h3>{{ row.deviceName }}</h3><span class="status" :data-state="row.state"><CheckCircleFilled v-if="['review', 'completed'].includes(row.state)" />{{ row.pendingSync ? '待同步' : row.state === 'review' ? '已提交' : row.state === 'completed' ? '已完成' : row.state === 'rectify' ? '待整改' : '待检查' }}</span></div>
      <p>{{ row.deviceSnapshot?.location || '—' }}</p>
      <div class="device-task-foot"><span>{{ row.standardSnapshot?.length || 0 }}项检查要求</span><span>{{ typeof target(row) === 'string' ? '查看详情' : row.state === 'rectify' ? '继续整改' : '开始检查' }}<RightOutlined /></span></div>
    </router-link>
    <a-empty v-if="!vm.busy && !vm.error && !vm.visible.length" description="当前任务下没有该设备组的设备" />
  </section>
</template>
<style scoped>
.section-heading { margin-top: 22px; }.section-heading h2 { display: flex; align-items: center; gap: 8px; }.section-heading .anticon { color: var(--sky-strong); }
.device-progress { display: flex; align-items: center; gap: 4px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.scan-icon { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 10px; color: var(--sky-strong); font-size: 21px; }
.scan-icon:hover, .scan-icon:focus-visible { background: var(--sky-soft); }.group-filter { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 12px; color: var(--muted); }
.device-task { display: block; padding: 16px; margin-bottom: 12px; border-radius: 14px; background: var(--surface); color: var(--ink); text-decoration: none; }
.device-task-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }.status { gap: 4px; }.device-task > p { margin-top: 8px; color: var(--muted); font-size: 13px; overflow-wrap: anywhere; }
.device-task-foot { display: flex; justify-content: space-between; gap: 8px; margin-top: 12px; color: var(--muted); font-size: 13px; }.device-task-foot > span:last-child { display: flex; align-items: center; gap: 8px; }
</style>
