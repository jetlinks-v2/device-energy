<script setup lang="ts">
import { ref } from 'vue'
import type { Option } from '../shared/types'
import { resourcePermission } from '../shared/permissions'
import { feText } from '../shared/i18n'
import TaskReview from './TaskReview.vue'
defineProps<{ kind?: string; options: Record<string, Option[]> }>()
const emit = defineEmits<{ changed: [] }>()
const open = ref(false)
</script>
<template>
  <j-permission-button :hasPermission="resourcePermission('tasks', kind, 'review')" type="primary" @click="open = true">
    {{ feText('approval') }}
  </j-permission-button>
  <TaskReview v-if="open" :kind="kind" :options="options" @close="open = false" @changed="emit('changed')" />
</template>
