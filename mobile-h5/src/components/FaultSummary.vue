<script setup lang="ts">
import { faultOverdue, faultState, type Fault } from '../../../shared/faults'
import { taskTime } from '../../../shared/types'
defineProps<{ row: Fault }>()
</script>
<template>
  <header class="repair-summary">
    <div class="repair-tags"><van-tag :type="row.state === 'closed' ? 'success' : row.state === 'assigned' ? 'warning' : 'primary'">{{ faultState(row.state)?.label }}</van-tag><van-tag v-if="row.priority === 'urgent'" type="danger" plain>紧急</van-tag><van-tag v-if="faultOverdue(row)" type="danger" plain>已逾期</van-tag></div>
    <h1>{{ row.name }}</h1>
    <p class="repair-device"><van-icon name="setting-o" /><span>{{ row.deviceName }}</span></p>
    <div class="repair-location"><span>{{ row.projectName }}</span><span v-if="row.deadline">截至 {{ taskTime(row.deadline) }}</span></div>
  </header>
</template>
<style scoped>
.repair-summary { background: var(--surface); border-radius: 12px; padding: 20px 16px; }
.repair-tags { display: flex; gap: 8px; margin-bottom: 10px; }
.repair-summary h1 { font-size: 22px; line-height: 1.4; margin: 0 0 14px; }
.repair-device { display: flex; align-items: flex-start; gap: 8px; overflow-wrap: anywhere; }
.repair-device .van-icon { margin-top: 3px; color: var(--sky-strong); flex-shrink: 0; }
.repair-location { display: flex; flex-wrap: wrap; gap: 4px 16px; margin-top: 10px; color: var(--muted); font-size: 13px; font-variant-numeric: tabular-nums; }
</style>
