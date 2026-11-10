<script setup lang="ts">
import type { TaskProcess } from '../shared/types'
import { display, taskTime } from '../shared/types'
import { actionNames } from '../shared/taskActions'
import { feText } from '../shared/i18n'
defineProps<{ rows: TaskProcess[]; total: number; page: number; busy: boolean; error: string }>()
const emit = defineEmits<{ page: [page: number] }>()
</script>
<template>
  <a-spin :spinning="busy">
    <a-alert v-if="error" type="error" :message="error" show-icon>
      <template #action><a-button type="link" @click="emit('page', page)">{{ feText('retry') }}</a-button></template>
    </a-alert>
    <a-timeline v-else-if="rows.length" style="padding-top: 6px">
      <a-timeline-item v-for="row in rows" :key="row.id">
        <a-space wrap><strong>{{ actionNames[row.action] || display(row.toState) }}</strong>
          <span>{{ row.creatorName || '—' }}</span><span>{{ taskTime(row.createTime) }}</span>
        </a-space>
        <div v-if="row.fromState">{{ display(row.fromState) }} → {{ display(row.toState) }}</div>
        <p v-if="row.comment" style="white-space: pre-wrap; overflow-wrap: anywhere; margin-bottom: 0">{{ row.comment }}</p>
      </a-timeline-item>
    </a-timeline>
    <a-empty v-else-if="!busy" :description="feText('noTaskHistory')" :image-style="{ height: '48px' }" />
    <a-pagination v-if="total > 20" :current="page" :total="total" :page-size="20"
      :show-size-changer="false" size="small" @change="emit('page', $event)" />
  </a-spin>
</template>
