<script setup lang="ts">
import { feText } from '../shared/i18n'
import { computed } from 'vue'
const props = defineProps<{ values: { time: number; value: number | string }[] }>()
const numbers = computed(() =>
  props.values.filter((v) => typeof v.value === 'number').map((v) => ({ time: v.time, value: Number(v.value) }))
)
const points = computed(() => {
  const rows = numbers.value
  if (!rows.length) return ''
  const min = Math.min(...rows.map((v) => v.value)),
    max = Math.max(...rows.map((v) => v.value)),
    start = rows[0].time,
    end = rows[rows.length - 1].time
  return rows
    .map(
      (v) =>
        `${20 + ((v.time - start) / Math.max(1, end - start)) * 760},${180 - ((v.value - min) / Math.max(0.001, max - min)) * 160}`
    )
    .join(' ')
})
</script>

<template>
  <svg
    v-if="numbers.length"
    viewBox="0 0 800 210"
    role="img"
    :aria-label="feText('historicalReadingChart')"
    style="width: 100%; max-height: 230px"
  >
    <path
      d="M20 20V180H780"
      fill="none"
      stroke="#bbb"
    />
    <polyline
      :points="points"
      fill="none"
      stroke="#1677ff"
      stroke-width="2"
    />
    <text
      x="20"
      y="205"
      font-size="11"
    >
      {{ new Date(numbers[0].time).toLocaleString() }}
    </text>
    <text
      x="780"
      y="205"
      text-anchor="end"
      font-size="11"
    >
      {{ new Date(numbers[numbers.length - 1].time).toLocaleString() }}
    </text>
  </svg>
  <a-empty
    v-else
    :description="feText('noValidNumericData')"
  />
</template>
