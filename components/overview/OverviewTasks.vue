<script setup lang="ts">
import { ref } from 'vue'
import { feText } from '../../shared/i18n'
import type { OverviewTaskDestination, OverviewTaskState } from '../../shared/overview'
import TaskReview from '../TaskReview.vue'
const props = defineProps<{ state: OverviewTaskState }>()
const emit = defineEmits<{ navigate: [target: OverviewTaskDestination, focus: string]; changed: [] }>()
const reviewKind = ref<'inspection' | 'maintenance'>()
const tasks = [
  { key: 'pendingClaim', label: 'awaitingClaim', icon: 'InboxOutlined', focus: 'claim', tone: 'blue' },
  { key: 'inProgress', label: 'overviewInProgress', icon: 'PlayCircleOutlined', focus: 'progress', tone: 'teal' },
  { key: 'pendingReview', label: 'reviewPending', icon: 'AuditOutlined', focus: 'review', tone: 'purple' },
  { key: 'overdue', label: 'overdueTasks', icon: 'ClockCircleOutlined', focus: 'overdue', tone: 'warning' }
] as const
const number = (key: string) => props.state.counts[key]?.toLocaleString() ?? '—'
const allowed = (kind: 'inspection' | 'maintenance', focus: string) =>
  focus === 'review' ? props.state.reviewAccess[kind] : props.state.access[kind]
const open = (kind: 'inspection' | 'maintenance', focus: string) => {
  if (!allowed(kind, focus)) return
  if (focus === 'review') reviewKind.value = kind
  else emit('navigate', kind, focus)
}
</script>
<template>
  <section class="overview-panel overview-task-panel">
    <header class="overview-section-head"><h2><AIcon type="CheckSquareOutlined" />{{ feText('overviewTaskQueue') }}</h2></header>
    <div class="overview-queue">
      <div v-for="item in tasks" :key="item.key" :class="['overview-queue-row', item.tone]">
        <span class="overview-queue-label"><AIcon :type="item.icon" />{{ feText(item.label) }}</span>
        <strong class="overview-count">{{ number(item.key) }}</strong>
        <a-dropdown v-if="allowed('inspection', item.focus) || allowed('maintenance', item.focus)" :trigger="['click']">
          <a-button type="link" :aria-label="feText(item.label)"><AIcon type="RightOutlined" /></a-button>
          <template #overlay><a-menu>
            <a-menu-item v-if="allowed('inspection', item.focus)" key="inspection" @click="open('inspection', item.focus)">{{ feText('inspection') }}</a-menu-item>
            <a-menu-item v-if="allowed('maintenance', item.focus)" key="maintenance" @click="open('maintenance', item.focus)">{{ feText('maintenance') }}</a-menu-item>
          </a-menu></template>
        </a-dropdown>
      </div>
    </div>
    <div class="overview-today"><div class="overview-caption">{{ feText('overviewToday') }}</div><div class="overview-today-grid">
      <a-button type="text" :disabled="!state.access.inspection" @click="emit('navigate', 'inspection', 'today')"><AIcon type="CheckSquareOutlined" />{{ feText('inspection') }}<strong>{{ number('todayinspection') }}</strong></a-button>
      <a-button type="text" :disabled="!state.access.maintenance" @click="emit('navigate', 'maintenance', 'today')"><AIcon type="ToolOutlined" />{{ feText('maintenance') }}<strong>{{ number('todaymaintenance') }}</strong></a-button>
    </div></div>
    <div class="overview-reminders">
      <span class="overview-caption">{{ feText('overviewReminders') }}</span>
      <a-button v-if="state.access.alerts" type="link" @click="emit('navigate', 'alerts', 'alerts')"><AIcon type="AlertOutlined" />{{ feText('pendingAlerts') }}<strong>{{ number('alerts') }}</strong></a-button>
      <a-button v-if="state.access.notifications" type="link" @click="emit('navigate', 'notifications', 'failed')"><AIcon type="BellOutlined" />{{ feText('failedNotifications') }}<strong>{{ number('notificationFailures') }}</strong></a-button>
    </div>
    <TaskReview v-if="reviewKind" :kind="reviewKind" :project-id="state.projectId" :options="{ projects: state.projects }" @close="reviewKind = undefined" @changed="emit('changed')" />
  </section>
</template>
