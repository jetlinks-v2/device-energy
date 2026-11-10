<script setup lang="ts">
import { reactive } from 'vue'
import { FileAddOutlined, ClockCircleOutlined, ExclamationCircleOutlined, RightOutlined } from '@ant-design/icons-vue'
import { useMessages } from '../hooks/useMessages'
import { unreadMessages } from '../hooks/useMessageBadge'
import { messageTiming } from '../services/taskMessages'
import { taskTime } from '../../../shared/types'
const vm = reactive(useMessages())
const icons = { new: FileAddOutlined, warning: ClockCircleOutlined, overdue: ExclamationCircleOutlined }
</script>
<template>
  <main class="page messages-page">
    <div class="message-toolbar"><a-radio-group v-model:value="vm.unreadOnly" button-style="solid"><a-radio-button :value="false">全部</a-radio-button><a-radio-button :value="true">未读</a-radio-button></a-radio-group><a-button type="link" :loading="vm.actionBusy" :disabled="!vm.online || !unreadMessages" @click="vm.readAll">全部已读</a-button></div>
    <a-alert v-if="!vm.online" type="info" message="当前无网络，联网后更新消息" show-icon />
    <a-alert v-if="vm.error" type="error" :message="vm.error" show-icon><template #action><a-button type="link" @click="vm.load()">重试</a-button></template></a-alert>
    <a-spin v-if="vm.busy && !vm.rows.length" class="loading" />
    <section v-if="vm.rows.length" class="message-list" aria-label="任务消息">
      <button v-for="row in vm.rows" :key="row.id" class="message-row" :class="{ unread: !row.readTime }" :disabled="vm.actionBusy || !vm.online" @click="vm.open(row)">
        <span class="message-icon" :data-type="row.messageType"><component :is="icons[row.messageType] || FileAddOutlined" /></span>
        <span class="message-content"><span class="message-heading"><strong>{{ row.title }}</strong><span v-if="!row.readTime" class="unread-dot" aria-label="未读" /></span>
          <span class="message-task">{{ row.taskName }}</span><span class="message-project">{{ row.projectName }}</span>
          <span class="message-info">{{ row.taskKind === 'maintenance' ? '维保' : '巡检' }} · 已提交{{ row.submittedDeviceCount }}/{{ row.deviceCount }}台</span>
          <span class="message-info">{{ taskTime(row.scheduledTime) }}—{{ taskTime(row.deadline) }}</span>
          <span class="message-footer"><span class="message-type" :data-type="row.messageType">{{ messageTiming(row, vm.now) }}</span><time>{{ taskTime(row.createTime) }}</time><RightOutlined /></span>
        </span>
      </button>
    </section>
    <a-empty v-else-if="!vm.busy && vm.online && !vm.error" :description="vm.unreadOnly ? '暂无未读消息' : '暂无消息'" />
    <a-button v-if="vm.rows.length < vm.total" block class="load-more" :loading="vm.busy" @click="vm.load(true)">加载更多</a-button>
  </main>
</template>
<style scoped>
.message-toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
.message-list { background: var(--surface, #fff); border-radius: 12px; overflow: hidden; }
.message-row { display: flex; width: 100%; gap: 12px; padding: 18px 16px; border: 0; border-bottom: 1px solid var(--line); background: transparent; text-align: left; color: var(--ink); cursor: pointer; }
.message-row:last-child { border-bottom: 0; }.message-row:hover, .message-row:focus-visible { background: var(--sky-soft); }
.message-row:disabled { cursor: default; }.message-content { display: grid; flex: 1; min-width: 0; gap: 5px; }
.message-icon { display: grid; place-items: center; width: 38px; height: 38px; flex-shrink: 0; background: var(--sky-soft); color: var(--sky-strong); border-radius: 10px; font-size: 17px; }
.message-icon[data-type="warning"] { color: #a85412; background: var(--surface, #fff); }.message-icon[data-type="overdue"] { color: #bf3535; background: var(--surface, #fff); }
.message-heading { display: flex; align-items: center; gap: 8px; justify-content: space-between; }.message-heading strong { font-size: 15px; line-height: 1.5; }
.unread-dot { display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: #bf3535; flex-shrink: 0; }
.message-task { font-size: 14px; overflow-wrap: anywhere; }.message-project, .message-info { font-size: 13px; line-height: 1.6; color: var(--muted); }
.message-footer { display: flex; align-items: center; gap: 8px; margin-top: 7px; font-size: 12px; color: var(--muted); }.message-footer time { margin-inline-start: auto; font-variant-numeric: tabular-nums; }
.message-type { color: var(--sky-strong); }.message-type[data-type="warning"] { color: #a85412; }.message-type[data-type="overdue"] { color: #bf3535; }
</style>
