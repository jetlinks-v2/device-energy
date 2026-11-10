<script setup lang="ts">
import { reactive } from 'vue'
import { CloudSyncOutlined, RightOutlined, CheckOutlined } from '@ant-design/icons-vue'
import { state } from '../services/session'
import { useOfflineMode } from '../hooks/useOfflineMode'
defineProps<{ entry?: boolean }>()
const vm = reactive(useOfflineMode())
</script>
<template>
  <button :class="entry ? 'offline-entry' : 'setting-row offline-setting'" :aria-pressed="state.offlineMode" :aria-label="state.offlineMode ? '关闭离线模式' : '开启离线模式'" :disabled="state.offlineBusy" @click="vm.toggle">
    <span :class="entry ? 'entry-icon sky' : 'setting-icon sky'" class="mode-icon"><CloudSyncOutlined /><CheckOutlined v-if="state.offlineMode" class="enabled-mark" /></span>
    <span>{{ state.offlineMode ? '关闭离线模式' : '离线模式' }}</span><RightOutlined v-if="!entry" />
  </button>
  <a-modal :open="state.offlineBusy && !!vm.progress" title="开启离线模式" :footer="null" :closable="false" :mask-closable="false" :keyboard="false" :width="340" centered><div class="cache-progress"><a-spin /><span>{{ vm.progress }}</span></div></a-modal>
  <a-modal v-model:open="vm.confirming" title="关闭离线模式？" ok-text="清空并关闭" cancel-text="继续使用" :confirm-loading="state.offlineBusy" :ok-button-props="{ danger: true }" :mask-closable="!state.offlineBusy" :closable="!state.offlineBusy" :width="340" centered @ok="vm.close">
    <p class="close-message">关闭后将清空本机缓存的任务、检查结果和照片，请确认所有数据已同步。</p>
    <p v-if="vm.summary.pending || vm.summary.drafts" class="unsynced-warning">还有 {{ vm.summary.pending }} 条未同步记录、{{ vm.summary.drafts }} 份未提交草稿，清空后无法恢复。</p>
    <a-alert v-if="vm.error" type="error" :message="vm.error" />
  </a-modal>
  <a-modal :open="!!vm.error && !vm.confirming" title="离线模式" :footer="null" :width="340" centered @cancel="vm.error = ''"><a-alert type="error" :message="vm.error" /></a-modal>
  <span v-if="vm.notice" role="status" class="sr-only">{{ vm.notice }}</span>
</template>
<style scoped>
.offline-entry { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; padding: 0; border: 0; background: none; color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.offline-setting { width: 100%; background: var(--surface); border: 0; text-align: left; font: inherit; cursor: pointer; }
.mode-icon { position: relative; }.enabled-mark { position: absolute; right: -3px; bottom: -3px; padding: 3px; border-radius: 50%; background: var(--success); color: var(--surface); font-size: 11px; }
.cache-progress { display: flex; align-items: center; gap: 14px; padding: 16px 0; }.close-message { margin-bottom: 12px; line-height: 1.75; }.unsynced-warning { margin-top: 12px; color: var(--danger); line-height: 1.75; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
