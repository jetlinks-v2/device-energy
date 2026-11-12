<script setup lang="ts">
import type { Task } from '../../../shared/types'
import { display, taskTime } from '../../../shared/types'
import { overdue } from '../services/taskQuery'
import { m } from '../services/mobileText'
defineProps<{ task: Task }>()
</script>
<template>
  <router-link class="task-row" :to="'/tasks/' + encodeURIComponent(task.id)">
    <div class="task-row-top"><span class="kind"><van-icon name="setting-o" v-if="task.kind === 'maintenance'" /><van-icon name="shield-o" v-else />{{ display(task.kind) }}</span><span class="status" :data-state="overdue(task) ? 'overdue' : task.state">{{ task.pendingSync ? '待同步' : overdue(task) ? m('已超期', 'Overdue') : display(task.state) }}</span></div>
    <h3>{{ task.name || task.deviceName }}</h3>
    <div class="task-device"><span>{{ task.deviceCount ? task.deviceCount + '台设备 · 已提交' + (task.submittedDeviceCount || 0) + '台' : task.deviceName }}<span class="task-project"> · {{ task.projectName || m('项目未命名', 'Unnamed project') }}</span></span><van-icon name="arrow" /></div>
    <div class="task-window"><van-icon name="clock-o" /><span>{{ taskTime(task.scheduledTime) }} {{ m('至', 'to') }} {{ taskTime(task.deadline) }}</span></div>
  </router-link>
</template>
