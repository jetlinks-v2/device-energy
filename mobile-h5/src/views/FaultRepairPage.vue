<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { onBeforeRouteLeave, useRouter } from 'vue-router'
import { showConfirmDialog, showToast, type UploaderFileListItem } from 'vant'
import { useFaultWork } from '../hooks/useFaultWork'
import FaultSummary from '../components/FaultSummary.vue'
import PhotoPreview from '../components/PhotoPreview.vue'
const vm = reactive(useFaultWork()), router = useRouter(), submitted = ref(false)
const editable = computed(() => vm.actions.includes('resolve'))
async function photo(file: UploaderFileListItem | UploaderFileListItem[]) {
  if (!Array.isArray(file) && file.file) await vm.photo(file.file)
}
async function submit() {
  if (!await vm.confirm('resolve')) return
  submitted.value = true
  showToast('已提交，等待负责人验收')
  await router.replace('/faults/' + encodeURIComponent(vm.selected!.id))
}
// 仅在离开未提交的填写页时确认，防止返回误丢维修结果和已上传照片。
onBeforeRouteLeave(async () => {
  if (vm.submitting) return false
  if (submitted.value || (!vm.comment.trim() && !vm.photos.length)) return true
  try { await showConfirmDialog({ title: '离开维修填写？', message: '维修结果和照片尚未提交，离开后将不保留本次填写。', confirmButtonText: '离开', cancelButtonText: '继续填写' }); return true } catch { return false }
})
</script>
<template>
  <main class="page repair-editor" :class="{ 'has-action-bar': editable }">
    <MobileNotice v-if="vm.error" :message="vm.error" type="error" /><MobileNotice v-if="!vm.online" message="网络已断开，恢复网络后可继续上传和提交" />
    <van-skeleton v-if="vm.busy" title :row="5" />
    <template v-else-if="vm.selected">
      <FaultSummary :row="vm.selected" />
      <section class="repair-context"><h2>故障情况</h2><p>{{ vm.selected.description }}</p><div v-if="vm.selected.attachments?.length" class="photos"><PhotoPreview v-for="id in vm.selected.attachments" :key="id" :id="id" /></div></section>
      <template v-if="editable">
        <section class="repair-form"><h2><label for="repair-result">维修结果</label><span>必填</span></h2><van-field id="repair-result" v-model="vm.comment" type="textarea" :readonly="vm.submitting" rows="5" autosize maxlength="4000" show-word-limit placeholder="填写故障原因、维修措施和处理结果" aria-label="维修结果" /></section>
        <section class="repair-form"><h2>维修照片<span>{{ vm.photos.length }} / 20</span></h2><div class="photos repair-upload"><PhotoPreview v-for="id in vm.photos" :key="id" :id="id" :removable="!vm.submitting" @remove="vm.photos = vm.photos.filter(value => value !== id)" /><van-uploader v-if="vm.photos.length < 20" :after-read="photo" :disabled="!vm.online || vm.submitting" :preview-image="false" :max-count="20" accept="image/*"><div class="repair-add"><van-loading v-if="vm.submitting" size="22" /><van-icon v-else name="photograph" /><span>{{ vm.submitting ? '上传中' : '添加照片' }}</span></div></van-uploader></div></section>
        <div class="action-bar"><van-button block type="primary" :loading="vm.submitting" :disabled="!vm.online" @click="submit">提交验收</van-button></div>
      </template>
      <van-empty v-else description="当前任务无需填写维修结果"><van-button plain type="primary" :to="'/faults/' + encodeURIComponent(vm.selected.id)">查看维修详情</van-button></van-empty>
    </template>
    <van-empty v-else-if="!vm.error" description="暂时无法查看该维修任务" />
  </main>
</template>
<style scoped>
.repair-editor > * + * { margin-top: 16px; }.repair-editor .action-bar { margin-top: 0; }
.repair-context, .repair-form { padding: 18px 16px; border-radius: 12px; background: var(--surface); }
.repair-context h2, .repair-form h2 { font-size: 16px; margin-bottom: 12px; }.repair-context p { white-space: pre-wrap; overflow-wrap: anywhere; }
.repair-form h2 { display: flex; align-items: center; justify-content: space-between; gap: 12px; }.repair-form h2 span { font-size: 13px; font-weight: 400; color: var(--muted); }
.repair-form :deep(.van-cell) { padding: 12px; background: var(--canvas); border-radius: 8px; }.repair-form :deep(textarea) { font-size: 15px; line-height: 1.65; }
.repair-upload { margin: 0; }.repair-add { width: 72px; height: 72px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 5px; border: 1px dashed var(--sky); border-radius: 8px; color: var(--sky-strong); background: var(--sky-soft); }
.repair-add .van-icon { font-size: 22px; }.repair-add span { font-size: 12px; }
</style>
