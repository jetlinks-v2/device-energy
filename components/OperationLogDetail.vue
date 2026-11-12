<script setup lang="ts">
import { computed } from 'vue'
import { feText } from '../shared/i18n'
import { type Entity, type Option, time } from '../shared/types'
import { resources, resourceCellText } from '../shared/resources'
import { operationStateText, resubmissionRecordId } from '../shared/operationLog'
import AttachmentsEditor from './AttachmentsEditor.vue'

const props = defineProps<{ record: Entity; projects: Option[] }>()
const emit = defineEmits<{ close: [] }>()
const files = computed(() => Array.isArray(props.record.attachments)
  ? props.record.attachments.filter((id): id is string => typeof id === 'string') : [])
const text = (key: string) => resourceCellText(resources.operations, key, props.record, props.projects)
</script>

<template>
  <a-modal :open="true" :title="feText('logDetail')" :width="680" :footer="null" @cancel="emit('close')">
    <a-descriptions :column="1" bordered class="operation-log-detail">
      <a-descriptions-item v-for="column in resources.operations.columns" :key="column.key" :label="column.title">
        {{ column.key === 'createTime' ? time(record.createTime) : text(column.key) }}
      </a-descriptions-item>
      <template v-if="(record.fromState || record.toState) && record.targetType !== 'binding' && record.action !== 'confirm-project'">
        <a-descriptions-item :label="feText('logBeforeState')">{{ operationStateText(record, 'fromState') }}</a-descriptions-item>
        <a-descriptions-item :label="feText('logAfterState')">{{ operationStateText(record, 'toState') }}</a-descriptions-item>
      </template>
      <a-descriptions-item v-if="record.targetType === 'binding' && record.toState" :label="feText('logCustomerId')">{{ record.toState }}</a-descriptions-item>
      <a-descriptions-item v-if="resubmissionRecordId(record)" :label="feText('logNewReadingId')">{{ resubmissionRecordId(record) }}</a-descriptions-item>
      <a-descriptions-item v-if="files.length" :label="feText('deviceAttachments')">
        <AttachmentsEditor :ids="files" readonly />
      </a-descriptions-item>
    </a-descriptions>
  </a-modal>
</template>

<style scoped>
.operation-log-detail { overflow-wrap: anywhere; white-space: pre-wrap; }
</style>
