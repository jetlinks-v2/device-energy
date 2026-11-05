<script setup lang="ts">
import { feText } from '../shared/i18n'
import type { Metric, Option } from '../shared/types'
import { metricOptions } from '../shared/resources'
const props = defineProps<{ items: Metric[]; properties: Option[] }>(),
  emit = defineEmits<{ change: [items: Metric[]] }>()
const update = (index: number, patch: Partial<Metric>) =>
  emit(
    'change',
    props.items.map((item, i) => (i === index ? { ...item, ...patch } : item))
  )
const add = () =>
  emit('change', [...props.items, { propertyId: '', name: '', kind: 'counter', unit: '', multiplier: 1, scale: 3 }])
const remove = (index: number) =>
  emit(
    'change',
    props.items.filter((_, i) => i !== index)
  )
</script>

<template>
  <a-space
    direction="vertical"
    style="width: 100%"
  >
    <a-card
      v-for="(item, index) in items"
      :key="index"
      size="small"
    >
      <a-row :gutter="12">
        <a-col :span="8">
          <a-form-item :label="feText('deviceModelProperty')">
            <a-select
              :value="item.propertyId"
              :options="properties"
              show-search
              option-filter-prop="label"
              @update:value="
                update(index, {
                  propertyId: $event as string,
                  name: properties.find((p) => p.value === $event)?.label || ''
                })
              "
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item :label="feText('readingType')">
            <a-select
              :value="item.kind"
              :options="metricOptions"
              @update:value="update(index, { kind: $event as string })"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item :label="feText('unit')">
            <a-input
              :value="item.unit"
              :placeholder="feText('kwhMCny')"
              @update:value="update(index, { unit: $event })"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-space wrap>
        <span>{{ feText('multiplier') }}</span>
        <a-input-number
          :value="item.multiplier"
          :min="0.000001"
          @update:value="update(index, { multiplier: Number($event) || 1 })"
        />
        <span>{{ feText('decimalPlaces') }}</span>
        <a-input-number
          :value="item.scale"
          :min="0"
          :max="12"
          @update:value="update(index, { scale: Number($event) || 0 })"
        />
        <a-button
          danger
          type="link"
          @click="remove(index)"
        >
          {{ feText('removeMetric') }}
        </a-button>
      </a-space>
    </a-card>
    <a-button @click="add">{{ feText('addMeteringMetric') }}</a-button>
    <a-typography-text type="secondary">
      {{ feText('cumulativeReadingsMeasureDifferencesInstantaneousMetricsShowTrendsCheckWhetherTheDevice') }}
    </a-typography-text>
  </a-space>
</template>
