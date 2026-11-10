<script setup lang="ts">
import { feText } from '../shared/i18n'
import { computed } from 'vue'
import { useNow } from '@vueuse/core'
import { planGenerationReason } from '../shared/planActions'
import type { Entity } from '../shared/types'
import { resources } from '../shared/resources'
import { resourcePermission } from '../shared/permissions'
const props = defineProps<{ resource: string; record: Entity; saving: boolean; kind?: string }>()
const config = computed(() => resources[props.resource])
const now = useNow({ interval: 1000 })
const generateReason = computed(() => planGenerationReason(props.record, false, now.value.getTime()))
const temporaryReason = computed(() => planGenerationReason(props.record, true, now.value.getTime()))
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
    <j-permission-button :hasPermission="config.readonly || resource === 'faults' ? true : resourcePermission(resource, String(record.kind || kind || ''))"
      v-if="!config.readonly || resource === 'devices' || resource === 'tasks'"
      type="link"
      @click="emit('open')"
    >
      {{ config.readonly || resource === 'faults' ? feText('details') : feText('edit') }}
    </j-permission-button>
    <a-popconfirm
      v-if="!config.readonly && config.fields.some(field => field.key === 'enabled')"
      :title="feText(record.enabled ? 'confirmDisable' : 'confirmEnable')"
      :disabled="saving"
      @confirm="emit('command', record.enabled ? 'disable' : 'enable')"
    >
      <j-permission-button :hasPermission="resourcePermission(resource, String(record.kind || kind || ''), 'toggle')"
        type="link" :disabled="saving" :danger="!!record.enabled"
      >
        {{ feText(record.enabled ? 'disable' : 'enable') }}
      </j-permission-button>
    </a-popconfirm>
    <j-permission-button :hasPermission="resourcePermission(resource, String(record.kind || kind || ''), 'qr')"
      v-if="resource === 'groups'"
      type="link"
      @click="emit('qr')"
    >
      {{ feText('roomQrCode') }}
    </j-permission-button>
    <template v-if="resource === 'plans'">
      <a-tooltip :title="generateReason">
      <span>
      <j-permission-button :hasPermission="resourcePermission(resource, String(record.kind || kind || ''), 'generate')"
        type="link"
        :disabled="saving || !!generateReason"
        @click="emit('command', 'generate')"
      >
        {{ feText('generateTasks') }}
      </j-permission-button>
      </span>
      </a-tooltip>
      <a-tooltip :title="temporaryReason">
      <span>
      <j-permission-button :hasPermission="resourcePermission(resource, String(record.kind || kind || ''), 'generate')"
        type="link"
        :disabled="saving || !!temporaryReason"
        @click="emit('command', 'temporary')"
      >
        {{ feText('adHocTask') }}
      </j-permission-button>
      </span>
      </a-tooltip>
    </template>
    <j-permission-button :hasPermission="resourcePermission(resource, String(record.kind || kind || ''))"
      v-if="resource === 'energy/mappings'"
      type="link"
      @click="emit('command', 'collect')"
    >
      {{ feText('collectNow') }}
    </j-permission-button>
    <j-permission-button :hasPermission="'facility/Faults:save'"
      v-if="resource === 'alerts' && record.deviceId"
      type="link"
      :disabled="saving"
      @click="emit('command', 'fault')"
    >
      {{ feText('registerFault') }}
    </j-permission-button>
    <template
      v-if="['alerts', 'planAlerts'].includes(resource) && !['closed', 'recovered'].includes(String(record.state))"
    >
      <j-permission-button :hasPermission="resourcePermission(resource, String(record.kind || kind || ''))"
        type="link"
        @click="emit('command', 'processing')"
      >
        {{ feText('process') }}
      </j-permission-button>
      <j-permission-button :hasPermission="resourcePermission(resource, String(record.kind || kind || ''))"
        type="link"
        @click="emit('command', 'closed')"
      >
        {{ feText('close') }}
      </j-permission-button>
    </template>
    <j-permission-button :hasPermission="resourcePermission(resource, String(record.kind || kind || ''))"
      v-if="['notifications', 'planNotifications'].includes(resource) && record.state === 'failed'"
      type="link"
      @click="emit('command', 'retry')"
    >
      {{ feText('retry') }}
    </j-permission-button>
    <template
      v-if="
        (resource === 'readings' && record.status === 'pending') ||
        (resource === 'replacements' && record.state === 'pending')
      "
    >
      <j-permission-button :hasPermission="resourcePermission(resource, String(record.kind || kind || ''))"
        type="link"
        @click="emit('command', 'approve')"
      >
        {{ feText('approve') }}
      </j-permission-button>
      <j-permission-button :hasPermission="resourcePermission(resource, String(record.kind || kind || ''))"
        type="link"
        danger
        @click="emit('command', 'reject')"
      >
        {{ feText('reject') }}
      </j-permission-button>
    </template>
    <template v-if="resource === 'faults'">
      <j-permission-button :hasPermission="resourcePermission(resource, String(record.kind || kind || ''))"
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
      </j-permission-button>
    </template>
    <a-popconfirm
      v-if="['standards', 'groups', 'cycles', 'plans', 'rules'].includes(resource)"
      :title="feText('disableAndDeleteThisConfigurationHistoricalRecordsWillBeRetained')"
      @confirm="emit('remove')"
    >
      <j-permission-button :hasPermission="resourcePermission(resource, String(record.kind || kind || ''), 'delete')"
        danger
        type="link"
      >
        {{ feText('delete') }}
      </j-permission-button>
    </a-popconfirm>
  </a-space>
</template>
