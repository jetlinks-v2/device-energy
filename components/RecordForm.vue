<script setup lang="ts">
import { ref } from 'vue'
import dayjs from 'dayjs'
import type { CycleRule } from '../shared/cycle/types'
import CycleRuleEditor from './CycleRuleEditor.vue'
import type { Field, FormValues, FormValue, Option, CheckItem, Metric } from '../shared/types'
import AttachmentsEditor from './AttachmentsEditor.vue'
import CheckItemsEditor from './CheckItemsEditor.vue'
import MetricEditor from './MetricEditor.vue'
defineProps<{ fields: Field[]; model: FormValues; options: Record<string, Option[]> }>()
const cycleEditor = ref<InstanceType<typeof CycleRuleEditor>>()
defineExpose({ validateCycle: () => cycleEditor.value?.validate() })
const emit = defineEmits<{ change: [key: string, value: FormValue] }>()
</script>

<template>
  <a-form
    layout="vertical"
    :model="model"
  >
    <a-row :gutter="16">
      <a-col
        v-for="field in fields"
        :key="field.key"
        :xs="24"
        :md="['checks', 'metrics', 'textarea', 'files', 'cycle'].includes(field.type || '') ? 24 : 12"
      >
        <a-form-item
          :label="field.label"
          :required="field.required"
        >
          <CycleRuleEditor v-if="field.type === 'cycle'" :ref="(value) => cycleEditor = value as InstanceType<typeof CycleRuleEditor>"
            :model-value="model[field.key] as CycleRule" @update:model-value="emit('change', field.key, $event)" />
          <a-switch
            v-else-if="field.type === 'switch'"
            :checked="!!model[field.key]"
            @update:checked="emit('change', field.key, $event)"
          />
          <a-input-number
            v-else-if="field.type === 'number'"
            :value="model[field.key] as number"
            style="width: 100%"
            @update:value="emit('change', field.key, $event ?? undefined)"
          />
          <a-tree-select
            v-else-if="field.type === 'tree'"
            :value="model[field.key] as string | undefined"
            :tree-data="options[field.source || ''] || []"
            :tree-data-simple-mode="{ id: 'value', pId: 'parentId' }"
            :field-names="{ label: 'label', value: 'value', children: 'children' }"
            :placeholder="field.label"
            :aria-label="field.label"
            tree-node-filter-prop="label"
            :tree-default-expand-all="field.source === 'organizations'"
            show-search
            allow-clear
            :dropdown-style="{ maxHeight: '360px', overflow: 'auto' }"
            @update:value="emit('change', field.key, $event)"
          />
          <a-select
            v-else-if="field.type === 'select' || field.type === 'multi'"
            :value="model[field.key] as string | string[]"
            :mode="field.type === 'multi' ? 'multiple' : undefined"
            :options="field.options || options[field.source || ''] || []"
            :disabled="field.disabled"
            show-search
            option-filter-prop="label"
            :allow-clear="!field.disabled"
            @update:value="emit('change', field.key, $event as string | string[])"
          />
          <a-date-picker
            v-else-if="field.type === 'date'"
            :value="model[field.key] as string | undefined"
            value-format="YYYY-MM-DD"
            format="YYYY-MM-DD"
            :placeholder="field.label"
            :aria-label="field.label"
            style="width: 100%"
            allow-clear
            @update:value="emit('change', field.key, typeof $event === 'string' && $event ? $event : undefined)"
          />
          <a-date-picker
            v-else-if="field.type === 'datetime'"
            :value="typeof model[field.key] === 'number' && Number.isFinite(model[field.key]) ? dayjs(model[field.key] as number) : undefined"
            :show-time="{ format: 'HH:mm' }"
            format="YYYY-MM-DD HH:mm"
            :placeholder="field.label"
            :aria-label="field.label"
            style="width: 100%"
            allow-clear
            @change="emit('change', field.key, $event ? dayjs($event).startOf('minute').valueOf() : undefined)"
          />
          <a-textarea
            v-else-if="field.type === 'textarea'"
            :value="model[field.key] as string"
            :rows="3"
            @update:value="emit('change', field.key, $event)"
          />
          <CheckItemsEditor
            v-else-if="field.type === 'checks'"
            :items="(model[field.key] as CheckItem[]) || []"
            @change="emit('change', field.key, $event)"
          />
          <MetricEditor
            v-else-if="field.type === 'metrics'"
            :items="(model[field.key] as Metric[]) || []"
            :properties="options.properties || []"
            @change="emit('change', field.key, $event)"
          />
          <AttachmentsEditor
            v-else-if="field.type === 'files'"
            :ids="(model[field.key] as string[]) || []"
            :project-id="typeof model.projectId === 'string' ? model.projectId : undefined"
            @change="emit('change', field.key, $event)"
          />
          <a-input
            v-else
            :value="model[field.key] as string"
            @update:value="emit('change', field.key, $event)"
          />
        </a-form-item>
      </a-col>
    </a-row>
  </a-form>
</template>
