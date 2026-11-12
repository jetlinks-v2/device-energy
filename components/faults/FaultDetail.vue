<script setup lang="ts">
import type { Fault } from '../../shared/faults'
import { faultActionText, faultState, faultOverdue } from '../../shared/faults'
import { taskTime, type TaskProcess } from '../../shared/types'
import { feText } from '../../shared/i18n'
import FaultPhotos from './FaultPhotos.vue'
defineProps<{ row: Fault; actions: string[]; history: TaskProcess[]; total: number; page: number; busy: boolean }>()
const emit = defineEmits<{ action: [action: string]; page: [page: number] }>()
</script>
<template>
  <a-spin :spinning="busy"><article class="fault-detail"><div class="fault-detail-content">
    <header><h2>{{ row.name }}</h2><a-space wrap><a-tag :color="faultState(row.state)?.color">{{ faultState(row.state)?.label }}</a-tag><a-tag v-if="row.priority === 'urgent'" color="red">{{ feText('faultUrgent') }}</a-tag><a-tag v-if="faultOverdue(row)" color="orange">{{ feText('faultOverdue') }}</a-tag></a-space></header>
    <dl><div><dt>{{ feText('businessProject') }}</dt><dd>{{ row.projectName }}</dd></div><div><dt>{{ feText('deviceName') }}</dt><dd>{{ row.deviceName }}</dd></div>
      <div><dt>{{ feText('faultRepairer') }}</dt><dd>{{ row.assigneeName || '—' }}</dd></div><div><dt>{{ feText('faultReviewer') }}</dt><dd>{{ row.reviewerName || '—' }}</dd></div>
      <div><dt>{{ feText('faultDeadline') }}</dt><dd>{{ taskTime(row.deadline) }}</dd></div><div><dt>{{ feText('faultSource') }}</dt><dd>{{ feText(row.sourceType === 'alert' ? 'faultSourceAlert' : row.sourceType === 'task' ? 'faultSourceTask' : 'faultSourceManual') }}</dd></div></dl>
    <section><h3>{{ feText('faultDescription') }}</h3><p class="fault-description">{{ row.description }}</p><FaultPhotos :ids="row.attachments || []" /></section>
    <section v-if="row.resolution"><h3>{{ feText('faultResolution') }}</h3><p class="fault-description">{{ row.resolution }}</p><FaultPhotos :ids="row.resolutionAttachments || []" /></section>
    <section v-if="row.closeReason"><h3>{{ feText('faultCloseReason') }}</h3><p>{{ row.closeReason }}</p></section>
    <section><h3>{{ feText('faultHistory') }}</h3><a-timeline><a-timeline-item v-for="item in history" :key="item.id"><strong>{{ faultActionText(item.action) }}</strong><span class="fault-meta">{{ item.creatorName }} · {{ taskTime(item.createTime) }}</span><p v-if="item.comment" class="fault-description">{{ item.comment }}</p><FaultPhotos v-if="item.attachments?.length" :ids="item.attachments" /></a-timeline-item></a-timeline><a-pagination v-if="total > 20" :current="page" :total="total" :page-size="20" size="small" :show-size-changer="false" @change="emit('page', $event)" /></section>
    </div><footer v-if="actions.length"><a-space wrap><a-button v-for="action in actions" :key="action" :type="['claim', 'start', 'resolve', 'approve', 'dispatch'].includes(action) ? 'primary' : 'default'" :danger="action === 'close'" @click="emit('action', action)">{{ faultActionText(action) }}</a-button></a-space></footer>
  </article></a-spin>
</template>
