<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import { reactive } from 'vue'
import { useAlert } from '../hooks/useAlert'
import { alertHandling, alertSignal, alertType, alertValue } from '../../../shared/alerts'
import { taskTime } from '../../../shared/types'
const vm = reactive(useAlert())
</script>
<template><main class="page alert-page">
  <MobileNotice v-if="vm.error" type="error" :message="vm.error"><template #action><van-button plain size="small" @click="vm.load">重试</van-button></template></MobileNotice>
  <van-loading v-if="vm.busy" class="loading" />
  <template v-if="vm.row"><section class="detail-section"><div class="alert-states"><van-tag :type="vm.row.state === 'recovered' ? 'success' : 'danger'">{{ alertSignal(vm.row.state) }}</van-tag><van-tag type="primary">{{ alertHandling(vm.row.processingState) }}</van-tag></div><h1>{{ vm.row.name }}</h1>
    <van-cell title="项目" :value="vm.row.projectName || '—'" /><van-cell title="预警类型" :value="alertType(vm.row.ruleType)" /><van-cell title="预警等级" :value="vm.row.level === 'critical' ? feText('criticalThreshold') : feText('alertThreshold')" />
    <van-cell v-if="vm.row.value != null" title="触发值" :value="alertValue(vm.row.value, vm.row.unit)" /><van-cell v-if="vm.row.threshold != null" title="阈值" :value="alertValue(vm.row.threshold, vm.row.unit)" />
  </section><section class="detail-section"><h2>预警记录</h2><van-cell title="首次发生" :value="taskTime(vm.row.firstTime)" /><van-cell title="最近发生" :value="taskTime(vm.row.lastTime)" /><van-cell title="恢复时间" :value="taskTime(vm.row.recoveredTime)" /><van-cell v-if="vm.row.occurrences != null" title="发生次数" :value="String(vm.row.occurrences)" /><p v-if="vm.row.comment" class="multiline">{{ vm.row.comment }}</p></section></template>
</main></template>
<style scoped>.alert-states { display: flex; gap: 8px; margin-bottom: 12px; }.alert-page h1 { font-size: 22px; margin-bottom: 12px; }.alert-page :deep(.van-cell) { padding-inline: 0; }.alert-page :deep(.van-cell__value) { flex: 1.5; overflow-wrap: anywhere; color: var(--ink); }</style>
