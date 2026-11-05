<script setup lang="ts">
import { feText } from '../shared/i18n'
import type { CheckItem } from '../shared/types'
const props = defineProps<{ items: CheckItem[] }>(),
  emit = defineEmits<{ change: [items: CheckItem[]] }>()
const update = (index: number, patch: Partial<CheckItem>) =>
  emit(
    'change',
    props.items.map((item, i) => (i === index ? { ...item, ...patch } : item))
  )
const add = () =>
  emit('change', [
    ...props.items,
    { id: crypto.randomUUID(), name: '', kind: 'boolean', required: true, photoRequired: false }
  ])
const remove = (index: number) =>
  emit(
    'change',
    props.items.filter((_, i) => i !== index)
  )
const kinds = [
  { value: 'boolean', label: feText('yesOrNo') },
  { value: 'number', label: feText('number') },
  { value: 'text', label: feText('text') },
  { value: 'choice', label: feText('choice') }
]
</script>

<template>
  <a-space
    direction="vertical"
    style="width: 100%"
  >
    <a-card
      v-for="(item, index) in items"
      :key="item.id"
      size="small"
    >
      <a-space wrap>
        <a-input
          :value="item.name"
          :placeholder="feText('inspectionItem')"
          @update:value="update(index, { name: $event })"
        />
        <a-select
          :value="item.kind"
          :options="kinds"
          style="width: 100px"
          @update:value="update(index, { kind: $event as string })"
        />
        <a-checkbox
          :checked="item.required"
          @update:checked="update(index, { required: $event })"
        >
          {{ feText('required') }}
        </a-checkbox>
        <a-checkbox
          :checked="item.photoRequired"
          @update:checked="update(index, { photoRequired: $event })"
        >
          {{ feText('photoRequired') }}
        </a-checkbox>
        <a-button
          danger
          type="link"
          @click="remove(index)"
        >
          {{ feText('remove') }}
        </a-button>
      </a-space>
      <a-space
        v-if="item.kind === 'number'"
        wrap
      >
        <a-input-number
          :value="item.minimum"
          :placeholder="feText('minimum')"
          @update:value="update(index, { minimum: $event == null ? undefined : Number($event) })"
        />
        <a-input-number
          :value="item.maximum"
          :placeholder="feText('maximum')"
          @update:value="update(index, { maximum: $event == null ? undefined : Number($event) })"
        />
      </a-space>
      <a-input
        v-if="item.kind === 'choice'"
        :value="item.options?.join('，')"
        :placeholder="feText('choicesSeparatedByCommas')"
        @update:value="update(index, { options: $event.split(/[,，]/).filter(Boolean) })"
      />
    </a-card>
    <a-button @click="add">{{ feText('addInspectionItem') }}</a-button>
  </a-space>
</template>
