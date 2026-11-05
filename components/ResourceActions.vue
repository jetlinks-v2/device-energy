<script setup lang="ts">
import { feText } from '../shared/i18n'
import { computed } from 'vue'
import type { Entity } from '../shared/types'
import { resources } from '../shared/resources'
const props = defineProps<{ resource: string; record: Entity; saving: boolean }>()
const config = computed(() => resources[props.resource])
const emit = defineEmits<{ open: []; qr: []; command: [action: string]; remove: [] }>()
const faultActionNames: Record<string, string> = {
  start: feText('startProcessing'),
  resolve: feText('submitForVerification'),
  approve: feText('verifyAndClose'),
  reject: feText('returnForProcessing')
}
</script>
<template>
  <a-space wrap>
    <a-button
      v-if="!config.readonly || resource === 'devices' || resource === 'tasks'"
      type="link"
      @click="emit('open')"
    >
      {{ config.readonly ? feText('details') : feText('edit') }}
    </a-button>
    <a-button
      v-if="resource === 'groups'"
      type="link"
      @click="emit('qr')"
    >
      {{ feText('roomQrCode') }}
    </a-button>
    <template v-if="resource === 'plans'">
      <a-button
        type="link"
        :disabled="saving"
        @click="emit('command', 'generate')"
      >
        {{ feText('generateTasks') }}
      </a-button>
      <a-button
        type="link"
        :disabled="saving"
        @click="emit('command', 'temporary')"
      >
        {{ feText('adHocTask') }}
      </a-button>
    </template>
    <a-button
      v-if="resource === 'energy/mappings'"
      type="link"
      @click="emit('command', 'collect')"
    >
      {{ feText('collectNow') }}
    </a-button>
    <template
      v-if="['alerts', 'planAlerts'].includes(resource) && !['closed', 'recovered'].includes(String(record.state))"
    >
      <a-button
        type="link"
        @click="emit('command', 'processing')"
      >
        {{ feText('process') }}
      </a-button>
      <a-button
        type="link"
        @click="emit('command', 'closed')"
      >
        {{ feText('close') }}
      </a-button>
    </template>
    <a-button
      v-if="['notifications', 'planNotifications'].includes(resource) && record.state === 'failed'"
      type="link"
      @click="emit('command', 'retry')"
    >
      {{ feText('retry') }}
    </a-button>
    <template
      v-if="
        (resource === 'readings' && record.status === 'pending') ||
        (resource === 'replacements' && record.state === 'pending')
      "
    >
      <a-button
        type="link"
        @click="emit('command', 'approve')"
      >
        {{ feText('approve') }}
      </a-button>
      <a-button
        type="link"
        danger
        @click="emit('command', 'reject')"
      >
        {{ feText('reject') }}
      </a-button>
    </template>
    <template v-if="resource === 'faults'">
      <a-button
        v-for="action in record.state === 'open'
          ? ['start']
          : record.state === 'processing'
            ? ['resolve']
            : record.state === 'review'
              ? ['approve', 'reject']
              : []"
        :key="action"
        type="link"
        @click="emit('command', action)"
      >
        {{ faultActionNames[action] }}
      </a-button>
    </template>
    <a-popconfirm
      v-if="['standards', 'groups', 'plans', 'rules'].includes(resource)"
      :title="feText('disableAndDeleteThisConfigurationHistoricalRecordsWillBeRetained')"
      @confirm="emit('remove')"
    >
      <a-button
        danger
        type="link"
      >
        {{ feText('delete') }}
      </a-button>
    </a-popconfirm>
  </a-space>
</template>
