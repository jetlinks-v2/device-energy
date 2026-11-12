<script setup lang="ts">
import { ref as collapseRef } from 'vue'
const expanded = collapseRef<string[]>([])
import { reactive, computed } from 'vue'
import { useSync } from '../hooks/useSync'
import { taskTime } from '../../../shared/types'
import { m } from '../services/mobileText'
import PhotoPreview from '../components/PhotoPreview.vue'
const vm = reactive(useSync())
const waiting = computed(() => vm.rows.filter(r => r.state === 'pending').length)
const labels = computed(() => ({ pending: m('待同步', 'Pending'), submitted: m('已同步', 'Synced'), conflict: m('任务冲突', 'Conflict') }))
</script>
<template>
  <main class="page">
    <div class="sync-heading"><van-icon name="exchange" /><div><strong>{{ waiting }}{{ m(' 条待同步', ' pending') }}</strong><span>{{ vm.online ? m('网络已连接', 'Connected') : m('当前离线', 'Offline') }}</span></div><van-button type="primary" :loading="vm.busy" :disabled="!vm.online || !waiting" @click="vm.replay">{{ m('同步', 'Sync') }}</van-button></div>
    <MobileNotice v-if="vm.error" :message="vm.error" type="error" show-icon />
    <article v-for="row in vm.rows" :key="row.id" class="sync-record">
      <div class="task-row-top"><span class="status" :data-state="row.state === 'conflict' ? 'rectify' : row.state === 'submitted' ? 'completed' : 'review'">{{ labels[row.state] }}</span><span class="muted">{{ taskTime(row.createdAt) }}</span></div>
      <router-link class="sync-task" :to="'/tasks/' + encodeURIComponent(row.taskId)"><strong>{{ row.taskName || m('任务检查结果', 'Task results') }}</strong><van-icon name="arrow" /></router-link>
      <MobileNotice v-if="row.error" :type="row.state === 'conflict' ? 'warning' : 'error'" :message="row.error" />
      <van-collapse v-model="expanded" v-if="row.state !== 'submitted'" ghost><van-collapse-item name="results" :title="m('查看本地检查结果', 'View local results')"><div v-for="(result, index) in row.command.results" :key="result.itemId" class="local-result"><h3>{{ row.requirements?.find(i => i.id === result.itemId)?.name || m('检查要求 ', 'Requirement ') + (index + 1) }}</h3><p>{{ result.value === 'true' ? m('符合', 'Compliant') : result.value === 'false' ? m('不符合', 'Noncompliant') : result.value }} {{ result.remark }}</p><div class="photos"><PhotoPreview v-for="file in result.attachments" :key="file" :id="file" /></div></div></van-collapse-item></van-collapse>
    </article>
    <van-empty v-if="!vm.rows.length" :description="m('暂无同步记录', 'No sync records')" />
  </main>
</template>
