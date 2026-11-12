<script setup lang="ts">
import { reactive } from 'vue'
import { state } from '../services/session'
import { useOfflineMode } from '../hooks/useOfflineMode'
defineProps<{ entry?: boolean }>()
const vm = reactive(useOfflineMode())
</script>
<template>
  <button :class="entry ? 'offline-entry' : 'setting-row offline-setting'" :aria-pressed="state.offlineMode" :aria-label="state.offlineMode ? '关闭离线模式' : '开启离线模式'" :disabled="state.offlineBusy" @click="vm.toggle">
    <span :class="entry ? 'entry-icon sky' : 'setting-icon sky'" class="mode-icon"><van-icon name="exchange" /><van-icon name="success" v-if="state.offlineMode" class="enabled-mark" /></span>
    <span>{{ state.offlineMode ? '关闭离线模式' : '离线模式' }}</span><van-icon name="arrow" v-if="!entry" />
  </button>
  <van-dialog :show="state.offlineBusy && !!vm.progress" title="开启离线模式" :show-confirm-button="false"><div class="cache-progress"><van-loading /><span>{{ vm.progress }}</span></div></van-dialog>
  <van-dialog :show="vm.confirming" title="关闭离线模式？" show-cancel-button confirm-button-text="清空并关闭" cancel-button-text="继续使用" :show-confirm-button="false" @cancel="!state.offlineBusy && (vm.confirming = false)">
    <div class="offline-dialog-content"><p class="close-message">关闭后将清空本机缓存的任务、检查结果和照片，请确认所有数据已同步。</p>
    <p v-if="vm.summary.pending || vm.summary.drafts" class="unsynced-warning">还有 {{ vm.summary.pending }} 条未同步记录、{{ vm.summary.drafts }} 份未提交草稿，清空后无法恢复。</p>
    <MobileNotice v-if="vm.error" type="error" :message="vm.error" /><van-button block type="danger" :loading="state.offlineBusy" @click="vm.close">清空并关闭</van-button></div>
  </van-dialog>
  <van-dialog :show="!!vm.error && !vm.confirming" title="离线模式" @confirm="vm.error = ''"><div class="offline-dialog-content"><MobileNotice type="error" :message="vm.error" /></div></van-dialog>
  <span v-if="vm.notice" role="status" class="sr-only">{{ vm.notice }}</span>
</template>
<style scoped>
.offline-dialog-content { padding: 20px; }
.offline-entry { display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 8px; width: 100%; padding: 0; border: 0; background: none; color: var(--ink); font: inherit; font-size: 13px; cursor: pointer; }
.offline-setting { width: 100%; background: var(--surface); border: 0; text-align: left; font: inherit; cursor: pointer; }
.mode-icon { position: relative; }.enabled-mark { position: absolute; right: -3px; bottom: -3px; padding: 3px; border-radius: 50%; background: var(--success); color: var(--surface); font-size: 11px; }
.cache-progress { display: flex; align-items: center; gap: 14px; padding: 16px 0; }.close-message { margin-bottom: 12px; line-height: 1.75; }.unsynced-warning { margin-top: 12px; color: var(--danger); line-height: 1.75; }
.sr-only { position: absolute; width: 1px; height: 1px; padding: 0; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
</style>
