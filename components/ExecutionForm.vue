<script setup lang="ts">
import { feText } from '../shared/i18n'
import type { Task, CheckResult } from '../shared/types'
const props = defineProps<{ task: Task; results: CheckResult[]; busy: boolean }>(),
  emit = defineEmits<{ change: [results: CheckResult[]]; photo: [itemId: string, file: File]; submit: []; draft: [] }>()
const update = (id: string, patch: Partial<CheckResult>) =>
  emit(
    'change',
    props.task.standardSnapshot.map((item) => {
      const existing = props.results.find((r) => r.itemId === item.id) || {
        itemId: item.id,
        value: '',
        abnormal: false,
        attachments: []
      }
      return item.id === id ? { ...existing, ...patch } : existing
    })
  )
const value = (id: string) => props.results.find((r) => r.itemId === id)?.value || ''
const photos = (id: string) => props.results.find((r) => r.itemId === id)?.attachments.length || 0
const photograph = (id: string, e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) emit('photo', id, file)
}
</script>

<template>
  <a-alert
    v-if="task.instructionSnapshot"
    :message="task.instructionSnapshot"
    type="info"
    style="white-space: pre-wrap; margin-bottom: 16px"
  />
  <a-form layout="vertical">
    <a-card
      v-for="item in task.standardSnapshot"
      :key="item.id"
      size="small"
      style="margin-bottom: 12px"
    >
      <a-form-item
        :label="item.name"
        :required="item.required"
      >
        <a-select
          v-if="item.kind === 'boolean' || item.kind === 'choice'"
          :value="value(item.id)"
          :options="
            item.kind === 'boolean'
              ? [
                  { value: 'true', label: feText('yes') },
                  { value: 'false', label: feText('no') }
                ]
              : item.options?.map((v) => ({ value: v, label: v }))
          "
          @update:value="update(item.id, { value: $event as string })"
        />
        <a-input
          v-else
          :value="value(item.id)"
          :type="item.kind === 'number' ? 'number' : 'text'"
          @update:value="update(item.id, { value: $event })"
        />
      </a-form-item>
      <a-space wrap>
        <a-checkbox
          :checked="results.find((r) => r.itemId === item.id)?.abnormal"
          @update:checked="update(item.id, { abnormal: $event })"
        >
          {{ feText('abnormalityFound') }}
        </a-checkbox>
        <label class="photo">
          {{ item.photoRequired ? feText('requiredPhotos') : feText('addPhoto') }}（{{ photos(item.id) }}）
          <input
            type="file"
            accept="image/*"
            capture="environment"
            :disabled="busy"
            @change="photograph(item.id, $event)"
          />
        </label>
      </a-space>
      <a-textarea
        :value="results.find((r) => r.itemId === item.id)?.remark"
        :placeholder="feText('executionOrAbnormalityNotes')"
        style="margin-top: 10px"
        @update:value="update(item.id, { remark: $event })"
      />
    </a-card>
    <a-space>
      <a-button @click="emit('draft')">{{ feText('saveDraft') }}</a-button>
      <j-permission-button
        :hasPermission="'facility/' + (task.kind === 'maintenance' ? 'Maintenance' : 'Inspection') + ':execute'"
        type="primary"
        :loading="busy"
        @click="emit('submit')"
      >
        {{ feText('submitResults') }}
      </j-permission-button>
    </a-space>
  </a-form>
</template>
<style scoped>
.photo {
  color: #1677ff;
  cursor: pointer;
}
.photo input {
  display: block;
  font-size: 12px;
  max-width: 240px;
  margin-top: 6px;
}
</style>
