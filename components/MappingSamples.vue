<script setup lang="ts">
import { feText } from '../shared/i18n'
import type { Option } from '../shared/types'
defineProps<{
  state: {
    templateId?: string
    options: Record<string, Option[]>
    previewRows: {
      propertyId: string
      time: number
      raw: string
      normalized?: number | string
      unit: string
      error?: string
    }[]
    saving: boolean
  }
}>()
const emit = defineEmits<{ select: [value: string]; apply: []; preview: [] }>()
</script>
<template>
  <a-space wrap>
    <a-select
      :value="state.templateId"
      @update:value="emit('select', String($event || ''))"
      :options="state.options.templates"
      :placeholder="feText('reuseMetricsFromASimilarMeter')"
      style="width: 300px"
    />
    <a-button @click="emit('apply')">{{ feText('applyTemplate') }}</a-button>
  </a-space>
  <a-alert
    type="info"
    :message="feText('afterApplyingATemplateVerifyTheActualModelPropertiesUnitsAndMultipliers')"
    style="margin: 12px 0"
  />
</template>
