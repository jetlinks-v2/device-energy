<script setup lang="ts">
import { computed, reactive } from 'vue'
import dayjs from 'dayjs'
import { feText } from '../../shared/i18n'
import { energyNames, type Option, type Reading } from '../../shared/types'
import { metricOptions } from '../../shared/resources'
import { useManualReading } from '../../hooks/useManualReading'
const props = defineProps<{ projects: Option[]; projectId?: string; original?: Reading }>()
const emit = defineEmits<{ close: []; saved: [] }>()
const vm = reactive(useManualReading(() => props.projectId || props.projects[0]?.value, () => emit('saved'), props.original))
const projects = computed(() => props.original?.projectId && !props.projects.some(project => project.value === props.original?.projectId)
  ? [...props.projects, { value: props.original.projectId, label: props.original.projectName || props.original.projectId }] : props.projects)
const meters = computed(() => vm.mappings.map(row => ({ value: row.id, label: `${row.name || row.deviceId} · ${energyNames[row.energyType] || row.energyType}` })))
const metrics = computed(() => vm.metrics.map(metric => ({ value: metric.propertyId,
  label: `${metric.name || metricOptions.find(item => item.value === metric.kind)?.label || metric.propertyId}${metric.unit ? ` (${metric.unit})` : ''}` })))
</script>
<template>
  <a-modal open :title="feText(original ? 'editRejectedReading' : 'manualReadingEntry')" :width="'min(560px, calc(100vw - 32px))'"
    :confirm-loading="vm.saving" :ok-text="feText('submitForReview')" :mask-closable="false"
    :closable="!vm.saving" :keyboard="!vm.saving" :cancel-button-props="{ disabled: vm.saving }"
    :body-style="{ maxHeight: 'calc(100dvh - 210px)', overflowY: 'auto' }" @ok="vm.submit" @cancel="emit('close')">
    <a-alert v-if="vm.error" type="error" show-icon :message="vm.error" class="reading-form-error" />
    <a-form layout="vertical" :disabled="vm.saving">
      <a-form-item :label="feText('businessProject')" required>
        <a-select :value="vm.form.projectId || undefined" :options="projects" :disabled="!!original" show-search option-filter-prop="label" @change="vm.changeProject" />
      </a-form-item>
      <a-form-item :label="feText('meter')" required>
        <a-select :value="vm.form.mappingId || undefined" :options="meters" :loading="vm.loading" show-search
          :filter-option="false" :disabled="!vm.form.projectId || !!original" allow-clear @search="vm.load" @change="vm.changeMeter" />
      </a-form-item>
      <a-form-item :label="feText('metric')" required>
        <a-select v-model:value="vm.form.propertyId" :options="metrics" :disabled="!!original || !vm.mapping || metrics.length === 1" />
      </a-form-item>
      <div class="reading-form-pair">
        <a-form-item :label="feText('rawReading')" required>
          <a-input-number v-model:value="vm.form.value" string-mode :min="0" :controls="false" style="width: 100%" />
        </a-form-item>
        <a-form-item :label="feText('readingTimestamp')" required>
          <a-date-picker :value="vm.form.observedTime ? dayjs(vm.form.observedTime) : undefined" show-time
            format="YYYY-MM-DD HH:mm:ss" style="width: 100%" @change="vm.form.observedTime = $event ? Number($event.valueOf()) : undefined" />
        </a-form-item>
      </div>
      <a-form-item :label="feText('reasonForManualReading')" required>
        <a-textarea v-model:value="vm.form.reason" :rows="3" :maxlength="4000" show-count />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
<style scoped>
.reading-form-error { margin-bottom: 16px; }
.reading-form-pair { display: grid; grid-template-columns: 1fr 1.5fr; gap: 16px; }
@media (max-width: 480px) { .reading-form-pair { grid-template-columns: 1fr; gap: 0; } }
</style>
