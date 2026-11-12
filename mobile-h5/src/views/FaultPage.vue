<script setup lang="ts">
import { reactive } from 'vue'
import { useFaultWork } from '../hooks/useFaultWork'
import { faultActionText, faultState } from '../../../shared/faults'
import { taskTime } from '../../../shared/types'
import PhotoPreview from '../components/PhotoPreview.vue'
const vm = reactive(useFaultWork())
</script>
<template><main class="page fault-mobile-page">
  <MobileNotice v-if="vm.error" :message="vm.error" type="error" /><van-loading v-if="vm.busy" class="loading" />
  <template v-if="vm.selected"><section class="detail-section"><van-tag type="primary">{{ faultState(vm.selected.state)?.label }}</van-tag><h1>{{ vm.selected.name }}</h1><van-cell title="项目" :value="vm.selected.projectName" /><van-cell title="设备" :value="vm.selected.deviceName" /><van-cell title="维修人" :value="vm.selected.assigneeName || '未派单'" /><van-cell title="验收负责人" :value="vm.selected.reviewerName" /><van-cell title="处理期限" :value="taskTime(vm.selected.deadline)" /></section>
    <section class="detail-section"><h2>故障情况</h2><p class="multiline">{{ vm.selected.description }}</p><div class="photos"><PhotoPreview v-for="id in vm.selected.attachments" :key="id" :id="id" /></div></section>
    <section v-if="vm.selected.resolution" class="detail-section"><h2>维修结果</h2><p class="multiline">{{ vm.selected.resolution }}</p><div class="photos"><PhotoPreview v-for="id in vm.selected.resolutionAttachments" :key="id" :id="id" /></div></section>
    <section v-if="vm.history.length || vm.historyBusy" class="detail-section"><h2>处理记录</h2><ol class="activity-list"><li v-for="record in vm.history" :key="record.id"><div><strong>{{ faultActionText(record.action) }}</strong><span>{{ taskTime(record.createTime) }}</span></div><p>{{ record.creatorName }}</p><p v-if="record.comment" class="multiline">{{ record.comment }}</p><div v-if="record.attachments?.length" class="photos"><PhotoPreview v-for="id in record.attachments" :key="id" :id="id" /></div></li></ol><van-button v-if="vm.history.length < vm.historyTotal" block :loading="vm.historyBusy" @click="vm.loadHistory(true)">加载更多记录</van-button></section>
    <div v-if="vm.actions.length" class="action-bar"><van-button v-for="action in vm.actions" :key="action" :type="action === 'reject' ? 'default' : 'primary'" :disabled="!vm.online || vm.submitting" @click="vm.open(action)">{{ faultActionText(action) }}</van-button></div>
  </template>
  <MobileSheet :show="!!vm.action" :title="faultActionText(vm.action)" :busy="vm.submitting" @update:show="!$event && (vm.action = '')"><MobileNotice v-if="vm.error" :message="vm.error" type="error" /><van-field v-if="['resolve', 'reject', 'approve'].includes(vm.action)" v-model="vm.comment" type="textarea" :required="vm.action !== 'approve'" :label="vm.action === 'resolve' ? '维修结果' : '验收说明'" rows="4" maxlength="4000" show-word-limit />
    <div v-if="vm.action === 'resolve'" class="photos"><PhotoPreview v-for="id in vm.photos" :key="id" :id="id" removable @remove="vm.photos = vm.photos.filter(value => value !== id)" /><van-uploader :after-read="file => !Array.isArray(file) && file.file && vm.photo(file.file)" :disabled="vm.submitting" :max-count="20" :preview-image="false" /></div>
    <van-button block type="primary" :loading="vm.submitting" @click="vm.confirm">{{ faultActionText(vm.action) }}</van-button>
  </MobileSheet>
</main></template>
<style scoped>.fault-mobile-page { padding-bottom: 96px; }.fault-mobile-page h1 { font-size: 22px; margin: 12px 0; }.fault-mobile-page .detail-section + .detail-section { margin-top: 14px; }.fault-mobile-page :deep(.van-cell) { padding-left: 0; padding-right: 0; }.fault-mobile-page :deep(.van-cell__value) { flex: 1.6; color: var(--ink); }.fault-mobile-page h2 { margin-bottom: 14px; }</style>
