<script setup lang="ts">
import { computed } from 'vue'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons-vue'
import { feText } from '../shared/i18n'
import type { CheckItem } from '../shared/types'
import { useCheckItems } from '../hooks/useCheckItems'
const props = defineProps<{ items: CheckItem[] }>(),
  emit = defineEmits<{ change: [items: CheckItem[]] }>()
const { update, add, remove } = useCheckItems(() => props.items, items => emit('change', items))
const columns = [
  { key: 'index', title: feText('sequenceNumber'), width: 56, align: 'center' as const },
  { key: 'name', title: feText('inspectionItem') },
  { key: 'kind', title: feText('checkResultType'), width: 124 },
  { key: 'required', title: feText('required'), width: 66, align: 'center' as const },
  { key: 'photo', title: feText('photoRequired'), width: 92, align: 'center' as const },
  { key: 'actions', title: feText('actions'), width: 58, align: 'center' as const }
]
const kinds = [
  { value: 'number', label: feText('number') },
  { value: 'text', label: feText('text') },
  { value: 'choice', label: feText('singleChoice') }
]
const expanded = computed(() => props.items.filter(item => ['number', 'choice'].includes(item.kind)).map(item => item.id))
</script>

<template>
  <section class="check-editor" :aria-label="feText('inspectionItems')">
    <a-table
      :columns="columns"
      :data-source="items"
      row-key="id"
      size="small"
      :pagination="false"
      :expanded-row-keys="expanded"
      :show-expand-column="false"
      :scroll="{ x: 640 }"
    >
      <template #emptyText>{{ feText('noInspectionItems') }}</template>
      <template #bodyCell="{ column, record: item, index }">
        <span v-if="column.key === 'index'" class="item-index">{{ index + 1 }}</span>
        <a-textarea v-else-if="column.key === 'name'" :value="item.name" :maxlength="256"
          :auto-size="{ minRows: 3, maxRows: 8 }"
          :placeholder="feText('enterCheckItemName')" :aria-label="feText('inspectionItem') + ' ' + (index + 1)"
          @update:value="update(item.id, { name: $event })" />
        <a-select v-else-if="column.key === 'kind'" :value="item.kind" :options="kinds"
          class="full-width" :aria-label="feText('checkResultType') + ' ' + (index + 1)"
          @update:value="update(item.id, { kind: $event as string })" />
        <a-checkbox v-else-if="column.key === 'required'" :checked="item.required"
          :aria-label="feText('required') + ' ' + (index + 1)"
          @update:checked="update(item.id, { required: $event })" />
        <a-checkbox v-else-if="column.key === 'photo'" :checked="item.photoRequired"
          :aria-label="feText('photoRequired') + ' ' + (index + 1)"
          @update:checked="update(item.id, { photoRequired: $event })" />
        <a-button v-else-if="column.key === 'actions'" type="text" danger
          :aria-label="feText('delete') + ' ' + (index + 1)" :title="feText('delete')"
          @click="remove(item.id)">
          <template #icon><DeleteOutlined /></template>
        </a-button>
      </template>
      <template #expandedRowRender="{ record: item }">
        <div v-if="item.kind === 'number'" class="check-configuration">
          <span class="configuration-label">{{ feText('normalRange') }}</span>
          <a-input-number :value="item.minimum" :placeholder="feText('minimum')" :aria-label="feText('minimum')"
            @update:value="update(item.id, { minimum: $event == null ? undefined : Number($event) })" />
          <span>—</span>
          <a-input-number :value="item.maximum" :placeholder="feText('maximum')" :aria-label="feText('maximum')"
            @update:value="update(item.id, { maximum: $event == null ? undefined : Number($event) })" />
        </div>
        <div v-else-if="item.kind === 'choice'" class="check-configuration">
          <span class="configuration-label">{{ feText('choice') }}</span>
          <a-tag v-for="option in item.options" :key="option">{{ option }}</a-tag>
        </div>
      </template>
    </a-table>
    <a-button type="dashed" block :disabled="items.length >= 100" class="add-check" @click="add">
      <template #icon><PlusOutlined /></template>
      {{ feText('addInspectionItem') }}
    </a-button>
  </section>
</template>

<style scoped>
.check-editor { min-width: 0; }
.full-width { width: 100%; }
.item-index { color: var(--ant-color-text-secondary, #595959); font-variant-numeric: tabular-nums; }
.check-configuration { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; padding: 2px 0 2px 40px; }
.configuration-label { flex: none; }
.add-check { margin-top: 12px; }
.check-editor :deep(.ant-table-thead > tr > th) { background: var(--ant-color-fill-alter, #fafafa); font-weight: 500; }
.check-editor :deep(.ant-table-expanded-row > td) { background: var(--ant-color-fill-alter, #fafafa); }
.check-editor :deep(.ant-table-cell) { padding: 10px 8px; }
</style>
