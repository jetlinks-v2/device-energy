<script setup lang="ts">
import { ref } from 'vue'
import { message } from 'ant-design-vue'
import { feText } from '../../shared/i18n'
import type { Option } from '../../shared/types'
import ManualReading from './ManualReading.vue'
import ReadingReview from './ReadingReview.vue'
defineProps<{ options: Record<string, Option[]>; projectId?: string }>()
const emit = defineEmits<{ changed: [] }>()
const manual = ref(false), review = ref(false), records = ref(false)
const saved = () => { manual.value = false; message.success(feText('readingSubmitted')); emit('changed') }
</script>
<template>
  <a-space>
    <j-permission-button has-permission="facility/Energy:manual-reading" type="primary" @click="manual = true">{{ feText('manualReadingEntry') }}</j-permission-button>
    <j-permission-button has-permission="facility/Energy:reading-records" @click="records = true">{{ feText('manualReadingRecords') }}</j-permission-button>
    <j-permission-button has-permission="facility/Energy:reading-review" @click="review = true">{{ feText('readingReviewAction') }}</j-permission-button>
  </a-space>
  <ManualReading v-if="manual" :projects="options.projects || []" :project-id="projectId" @close="manual = false" @saved="saved" />
  <ReadingReview v-if="review" :options="options" @close="review = false" @changed="emit('changed')" />
  <ReadingReview v-if="records" :options="options" mine @close="records = false" @changed="emit('changed')" />
</template>
