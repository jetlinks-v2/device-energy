<script setup lang="ts">
import { computed, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useMobileTask } from '../hooks/useMobileTask'
import { useTaskOperations } from '../hooks/useTaskOperations'
import { display, taskTime } from '../../../shared/types'
import { actionNames } from '../../../shared/taskActions'
import { m } from '../services/mobileText'
import MobileChecks from '../components/MobileChecks.vue'
import TaskDevices from '../components/TaskDevices.vue'
const route = useRoute(), vm = reactive(useMobileTask(String(route.params.id), () => route.query.scan))
const ops = reactive(useTaskOperations(() => vm.task, vm.load))
const scanTarget = computed(() => ({ path: '/scan', query: { taskId: vm.task?.parentTaskId || vm.task?.id, deviceId: vm.task?.deviceId } }))
const actionTitle = computed(() => ({ transfer: m('转单', 'Transfer task'), approve: m('审批通过', 'Approve task'), reject: m('驳回整改', 'Return for rectification') })[ops.action] || '')
</script>
<template>
  <main class="page task-page" :class="{ 'has-action-bar': vm.executable || vm.claimable || ops.reviewable }">
    <MobileNotice v-if="vm.error" :message="vm.error" type="error" show-icon /><MobileNotice v-if="vm.notice" :message="vm.notice" type="success" show-icon />
    <MobileNotice v-if="!vm.online" type="warning" :message="'离线模式 · 结果保存后，请到同步中心上传'" />
    <MobileNotice v-if="vm.pending" type="info" :message="m('检查结果已保存，请到同步中心查看提交状态', 'Results saved. Check submission status in Sync')"><template #action><router-link to="/sync">{{ m('查看', 'View') }}</router-link></template></MobileNotice>
    <van-loading v-if="vm.busy && !vm.task" class="loading" />
    <template v-if="vm.task">
      <section class="task-overview">
        <div class="task-title"><h1>{{ vm.task.parentTaskId ? vm.task.deviceName : vm.task.name || vm.task.deviceName }}</h1><div class="task-status"><span class="status" :data-state="vm.task.state">{{ vm.task.pendingSync ? '待同步' : vm.task.parentTaskId && vm.task.state === 'review' ? '已提交' : display(vm.task.state) }}</span><router-link v-if="vm.scannable && !vm.executable" :to="scanTarget" class="scan-icon" aria-label="扫描设备二维码" title="扫描设备二维码"><van-icon name="scan" /></router-link></div></div>
        <dl class="task-facts">
          <div><dt>{{ m('作业类型', 'Work type') }}</dt><dd>{{ display(vm.task.kind) }}</dd></div>
          <div><dt>{{ m('所属项目', 'Project') }}</dt><dd>{{ vm.task.projectName || '—' }}</dd></div>
          <div v-if="!vm.task.parentTaskId"><dt>{{ m('设备', 'Device') }}</dt><dd>{{ vm.task.deviceCount ? vm.task.deviceCount + '台设备' : vm.task.deviceName }}</dd></div>
          <template v-if="vm.task.parentTaskId"><div><dt>设备位置</dt><dd>{{ vm.task.deviceSnapshot?.location || '—' }}</dd></div><div v-if="vm.task.deviceSnapshot?.specification"><dt>规格型号</dt><dd>{{ vm.task.deviceSnapshot.specification }}</dd></div></template>
          <div v-if="vm.task.reviewerId || vm.task.reviewerName"><dt>{{ m('负责人', 'Reviewer') }}</dt><dd>{{ vm.task.reviewerName || vm.personName(vm.task.reviewerId) }}</dd></div>
          <div v-if="vm.task.assigneeId"><dt>{{ m('接单人', 'Assignee') }}</dt><dd>{{ vm.task.assigneeName || vm.personName(vm.task.assigneeId) }}</dd></div>
        </dl>
        <MobileNotice v-if="vm.peopleError" type="warning" :message="m('人员名称加载失败：', 'Staff names unavailable: ') + vm.peopleError" />
        <div v-if="ops.transferable" class="task-utilities">
          <button v-if="ops.transferable" class="text-button" :disabled="!vm.online || vm.busy || vm.pending" @click="ops.open('transfer')"><van-icon name="exchange" />{{ m('转单', 'Transfer') }}</button>
        </div>
      </section>
      <section class="task-schedule detail-section">
        <h2><van-icon name="clock-o" />{{ m('执行时间', 'Execution window') }}</h2>
        <dl class="task-facts">
          <div><dt>{{ m('开始时间', 'Starts') }}</dt><dd>{{ taskTime(vm.task.scheduledTime) }}</dd></div>
          <div><dt>{{ m('结束时间', 'Ends') }}</dt><dd>{{ taskTime(vm.task.deadline) }}</dd></div>
        </dl>
      </section>
      <MobileNotice v-if="vm.task.state === 'rectify' && vm.task.reviewComment" type="warning" show-icon :message="m('整改原因：', 'Rectification: ') + vm.task.reviewComment" />
      <TaskDevices v-if="vm.task.deviceCount" :task="vm.task" />
      <MobileChecks v-else :items="vm.task.standardSnapshot" :results="vm.results" :readonly="!vm.executable" :preview="!vm.executable && !vm.results.length" :busy="vm.busy" @change="vm.results = $event" @photo="vm.photo" />
      <section v-if="!vm.task.parentTaskId && (ops.history.length || ops.historyError || ops.historyBusy)" class="detail-section">
        <div class="section-heading"><h2>处理记录</h2></div>
        <MobileNotice v-if="ops.historyError" type="error" :message="ops.historyError"><template #action><van-button class="mobile-text-button" plain @click="ops.loadHistory()">重试</van-button></template></MobileNotice>
        <ol class="activity-list"><li v-for="record in ops.history" :key="record.id"><div><strong>{{ actionNames[record.action] || display(record.action) }}</strong><span>{{ taskTime(record.createTime) }}</span></div><p>{{ record.creatorName || '—' }} · {{ display(record.toState) }}</p><p v-if="record.comment" class="multiline">{{ record.comment }}</p></li></ol>
        <van-button v-if="ops.history.length < ops.total" block :loading="ops.historyBusy" @click="ops.loadHistory(true)">更多记录</van-button>
      </section>
      <div v-if="vm.claimable || vm.executable || ops.reviewable" class="action-bar">
        <van-button v-if="vm.claimable" type="primary" block :loading="vm.busy" :disabled="!vm.online" @click="vm.claim">接单</van-button>
        <template v-else-if="vm.executable"><van-button :disabled="vm.busy" @click="vm.draft">{{ m('保存草稿', 'Save draft') }}</van-button><van-button type="primary" :loading="vm.busy" @click="vm.submit">{{ m('提交检查', 'Submit results') }}</van-button></template>
        <template v-else-if="ops.reviewable"><van-button :disabled="!vm.online || ops.busy" @click="ops.open('reject')">{{ m('驳回', 'Return') }}</van-button><van-button type="primary" :disabled="!vm.online || ops.busy" @click="ops.open('approve')">{{ m('审批通过', 'Approve') }}</van-button></template>
      </div>
    </template>
    <van-button v-else-if="!vm.busy" block @click="vm.load">{{ m('重新加载任务', 'Reload task') }}</van-button>
    <MobileSheet :show="!!ops.action" :title="actionTitle" :busy="ops.busy" @update:show="!$event && (ops.action = '')">
      <p>{{ vm.task?.name }}</p><MobileNotice v-if="ops.error" type="error" :message="ops.error" />
      <template v-if="ops.action === 'transfer'"><label class="field-label">{{ m('接单人', 'Assignee') }}</label><MobileSelect v-model="ops.userId" :options="ops.people.map(p => ({ value: p.id, label: p.name }))" title="选择接单人" :disabled="ops.busy" /></template>
      <label class="field-label" for="action-comment">{{ ops.action === 'reject' ? m('原因 *', 'Reason *') : m('备注', 'Comment') }}</label><van-field type="textarea" id="action-comment" v-model="ops.comment" :rows="3" :maxlength="1000" />
      <van-button type="primary" block class="load-more" :loading="ops.busy" :disabled="!vm.online" @click="ops.confirm">{{ actionTitle }}</van-button>
    </MobileSheet>
  </main>
</template>
<style scoped>
.task-title { display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--line); }
.task-title h1 { margin: 0; font-size: 23px; line-height: 1.5; }
.task-title .status { margin-top: 3px; }
.task-status { display: flex; align-items: center; gap: 4px; flex-shrink: 0; }.task-status .status { margin-top: 0; }
.scan-icon { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 42px; border-radius: 10px; color: var(--sky-strong); font-size: 21px; }.scan-icon:hover, .scan-icon:focus-visible { background: var(--sky-soft); }
.task-facts { display: grid; gap: 10px; margin-top: 16px; }
.task-facts > div { margin: 0; grid-template-columns: 72px minmax(0, 1fr); gap: 12px; }
.task-facts dt, .task-facts dd { font-size: 14px; line-height: 1.6; }
.task-facts dd { font-variant-numeric: tabular-nums; }
.task-page { min-height: calc(100dvh - 58px - env(safe-area-inset-top)); }
.task-overview, .task-schedule { border-radius: 14px; box-shadow: 0 3px 14px rgb(32 52 72 / 4%); }
.task-overview { padding: 20px 16px; margin-bottom: 14px; }
.task-schedule { padding: 18px 16px; margin-bottom: 14px; }
.task-schedule h2 { display: flex; align-items: center; gap: 8px; margin-bottom: 0; }
.task-schedule h2 .van-icon { color: var(--sky-strong); font-size: 17px; }
.task-schedule .task-facts { gap: 12px; }
</style>
