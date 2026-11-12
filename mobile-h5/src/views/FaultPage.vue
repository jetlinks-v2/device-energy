<script setup lang="ts">
import { reactive } from 'vue'
import { useRouter } from 'vue-router'
import { showToast } from 'vant'
import { useFaultWork } from '../hooks/useFaultWork'
import { taskTime } from '../../../shared/types'
import { faultActionText, faultState } from '../../../shared/faults'
import PhotoPreview from '../components/PhotoPreview.vue'
const vm = reactive(useFaultWork()), router = useRouter()
async function act(value: string) {
  if (!await vm.confirm(value)) return
  if (value === 'start') await router.push('/faults/' + encodeURIComponent(vm.selected!.id) + '/repair')
  else showToast(({ claim: '已接单', approve: '验收通过', reject: '已退回维修人' } as Record<string, string>)[value])
}
</script>
<template>
  <main class="page repair-detail" :class="{ 'has-action-bar': vm.actions.length }">
    <MobileNotice v-if="vm.error" :message="vm.error" type="error" />
    <MobileNotice v-if="!vm.online" message="维修任务需联网处理，请先恢复网络" />
    <van-skeleton v-if="vm.busy" title :row="5" />
    <template v-else-if="vm.selected">
      <section class="detail-section repair-overview"><van-tag type="primary">{{ faultState(vm.selected.state)?.label }}</van-tag><h1>{{ vm.selected.name }}</h1><van-cell title="项目" :value="vm.selected.projectName" /><van-cell title="设备" :value="vm.selected.deviceName" /><van-cell title="维修人" :value="vm.selected.assigneeName || '未派单'" /><van-cell title="验收负责人" :value="vm.selected.reviewerName" /><van-cell title="处理期限" :value="taskTime(vm.selected.deadline)" /></section>
      <section class="detail-section repair-section"><h2>故障情况</h2><p class="multiline">{{ vm.selected.description }}</p><div v-if="vm.selected.attachments?.length" class="photos"><PhotoPreview v-for="id in vm.selected.attachments" :key="id" :id="id" /></div></section>
      <section v-if="vm.selected.resolution" class="detail-section repair-section"><h2>维修结果</h2><p class="multiline">{{ vm.selected.resolution }}</p><div v-if="vm.selected.resolutionAttachments?.length" class="photos"><PhotoPreview v-for="id in vm.selected.resolutionAttachments" :key="id" :id="id" /></div></section>
      <section v-if="vm.actions.includes('approve')" class="detail-section repair-section repair-review"><h2><label for="repair-review-comment">验收意见</label></h2><van-field id="repair-review-comment" v-model="vm.comment" :readonly="vm.submitting" type="textarea" rows="3" autosize maxlength="4000" show-word-limit placeholder="通过可不填，退回请说明需要整改的内容" aria-label="验收意见" /></section>
      <section v-if="vm.selected.closeReason" class="detail-section repair-section"><h2>关闭原因</h2><p class="multiline">{{ vm.selected.closeReason }}</p></section>
      <section v-if="vm.history.length || vm.historyBusy" class="detail-section repair-section"><h2>处理记录</h2><ol class="activity-list"><li v-for="record in vm.history" :key="record.id"><div><strong>{{ faultActionText(record.action) }}</strong><span>{{ taskTime(record.createTime) }}</span></div><p>{{ record.creatorName }}</p><p v-if="record.comment" class="multiline">{{ record.comment }}</p><div v-if="record.attachments?.length" class="photos"><PhotoPreview v-for="id in record.attachments" :key="id" :id="id" /></div></li></ol><van-button v-if="vm.history.length < vm.historyTotal" block :loading="vm.historyBusy" @click="vm.loadHistory(true)">加载更多记录</van-button></section>
      <div v-if="vm.actions.length" class="action-bar repair-dock">
        <van-button v-if="vm.actions.includes('reject')" :disabled="!vm.online || vm.submitting" @click="act('reject')">退回重做</van-button>
        <van-button v-if="vm.actions.includes('approve')" type="primary" :loading="vm.submitting" :disabled="!vm.online" @click="act('approve')">验收通过</van-button>
        <van-button v-if="vm.actions.includes('claim')" block type="primary" :loading="vm.submitting" :disabled="!vm.online" @click="act('claim')">接单</van-button>
        <van-button v-if="vm.actions.includes('start')" block type="primary" :loading="vm.submitting" :disabled="!vm.online" @click="act('start')">处理</van-button>
        <van-button v-if="vm.actions.includes('resolve')" block type="primary" :disabled="!vm.online" :to="'/faults/' + encodeURIComponent(vm.selected.id) + '/repair'">处理</van-button>
      </div>
    </template>
    <van-empty v-else-if="!vm.error" description="暂时无法查看该维修任务" />
  </main>
</template>
<style scoped>
.repair-detail > * + * { margin-top: 14px; }.repair-detail .action-bar { margin-top: 0; }
.repair-section h2 { font-size: 16px; margin-bottom: 12px; }.repair-section p { white-space: pre-wrap; overflow-wrap: anywhere; }
.repair-overview h1 { font-size: 22px; margin: 12px 0; }.repair-overview :deep(.van-cell) { padding-left: 0; padding-right: 0; }.repair-overview :deep(.van-cell__value) { flex: 1.6; color: var(--ink); }
.repair-review :deep(.van-cell) { padding: 12px; background: var(--canvas); border-radius: 8px; }.repair-review :deep(textarea) { font-size: 15px; }
.repair-dock .van-button { flex: 1; }.repair-dock .van-button--primary { flex: 1.6; }
</style>
