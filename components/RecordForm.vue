<script setup lang="ts">
import type { Field, FormValues, FormValue, Option, CheckItem, Metric } from '../shared/types'
import AttachmentsEditor from './AttachmentsEditor.vue'
import CheckItemsEditor from './CheckItemsEditor.vue'
import MetricEditor from './MetricEditor.vue'
defineProps<{ fields: Field[]; model: FormValues; options: Record<string, Option[]> }>()
const emit = defineEmits<{ change: [key: string, value: FormValue] }>()
const dateText = (v: unknown) =>
  typeof v === 'number' ? new Date(v - new Date(v).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''
const dateValue = (e: Event) => new Date((e.target as HTMLInputElement).value).getTime()
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
        :md="['checks', 'metrics', 'textarea', 'files'].includes(field.type || '') ? 24 : 12"
      >
        <a-form-item
          :label="field.label"
          :required="field.required"
        >
          <a-switch
            v-if="field.type === 'switch'"
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
            show-search
            option-filter-prop="label"
            allow-clear
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
          <input
            v-else-if="field.type === 'datetime'"
            type="datetime-local"
            :value="dateText(model[field.key])"
            @change="emit('change', field.key, dateValue($event))"
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
<style scoped>
input[type='datetime-local'] {
  width: 100%;
  border: 1px solid #d9d9d9;
  border-radius: 6px;
  padding: 5px 10px;
}
</style>
