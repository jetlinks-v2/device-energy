<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { can, state } from '../services/session'
import { useTaskList, type ListMode } from '../hooks/useTaskList'
import TaskRow from '../components/TaskRow.vue'
import { m } from '../services/mobileText'
const route = useRoute(), router = useRouter(), search = ref(''), applied = ref(''), drawer = ref(false)
const from = ref(''), to = ref(''), dateError = ref(''), dates = reactive<{ from?: number; to?: number }>({})
const mode = computed<ListMode>(() => {
  const requested = String(route.query.mode || 'mine')
  if (requested === 'review' && can('review')) return 'review'
  if (requested === 'dispatch' && can('dispatch')) return 'dispatch'
  return ['pool', 'offline'].includes(requested) ? requested as ListMode : 'mine'
})
const status = computed(() => String(route.query.status ?? (mode.value === 'mine' ? 'active' : mode.value === 'pool' ? 'open' : '')))
const kind = computed(() => String(route.query.kind || ''))
const review = computed(() => ['approved', 'rejected', 'all'].includes(String(route.query.review)) ? route.query.review as 'approved' | 'rejected' | 'all' : 'pending')
const vm = reactive(useTaskList(() => ({ projectId: state.projectId, kind: kind.value, status: mode.value === 'review' ? '' : status.value, search: applied.value, ...dates }), () => mode.value, () => review.value))
const tabs = computed(() => mode.value === 'review'
  ? [['pending', m('待审批', 'Pending')], ['approved', m('已通过', 'Approved')], ['rejected', m('已驳回', 'Returned')], ['all', m('全部', 'All')]]
  : mode.value === 'pool' ? [] : [['active', m('待处理', 'To do')], ['executing', m('进行中', 'In progress')], ['upcoming', m('未开始', 'Upcoming')], ['rectify', m('待整改', 'Rectify')], ['review', m('待审批', 'In review')], ['completed', m('已完成', 'Completed')], ['overdue', m('已超期', 'Overdue')], ['', m('全部', 'All')]])
function change(key: string, value: string) { void router.replace({ query: { ...route.query, [key]: value } }) }
function switchMode(value: string) { void router.replace({ query: { kind: kind.value || undefined, mode: value } }) }
function applyDates() {
  const start = from.value ? new Date(from.value + 'T00:00:00+08:00').getTime() : undefined
  const end = to.value ? new Date(to.value + 'T23:59:59.999+08:00').getTime() : undefined
  if (start != null && end != null && start > end) { dateError.value = m('结束日期不能早于开始日期', 'End date must follow start date'); return }
  dates.from = start; dates.to = end; dateError.value = ''; drawer.value = false
}
</script>
<template>
  <main class="page list-page">
    <template v-if="can('query')">
      <div v-if="['mine', 'pool'].includes(mode)" class="segmented"><button :class="{ active: mode === 'mine' }" @click="switchMode('mine')">{{ m('我的任务', 'My tasks') }}</button><button :class="{ active: mode === 'pool' }" @click="switchMode('pool')">{{ m('工单池', 'Task pool') }}</button></div>
      <div class="search-row"><van-search v-model="search" clearable :placeholder="m('搜索任务、设备', 'Search tasks or devices')" @search="applied = search" /><van-button :aria-label="m('筛选', 'Filter')" :class="{ 'filter-active': dates.from || dates.to }" @click="drawer = true"><van-icon name="filter-o" /></van-button></div>
      <div class="kind-tabs"><button v-for="entry in [['', m('全部', 'All')], ['inspection', m('巡检', 'Inspection')], ['maintenance', m('维保', 'Maintenance')]]" :key="entry[0]" :class="{ active: kind === entry[0] }" @click="change('kind', entry[0])">{{ entry[1] }}</button></div>
      <div v-if="tabs.length" class="scroll-tabs" :aria-label="m('任务状态', 'Task status')"><button v-for="tab in tabs" :key="tab[0]" :class="{ active: (mode === 'review' ? review : status) === tab[0] }" @click="change(mode === 'review' ? 'review' : 'status', tab[0])">{{ tab[1] }}</button></div>
      <div v-if="dates.from || dates.to" class="filter-summary"><span>{{ from || '—' }} ~ {{ to || '—' }}</span><button class="text-button" @click="from = ''; to = ''; applyDates()">{{ m('清除', 'Clear') }}</button></div>
      <div class="section-heading"><span>{{ m('共 ', '') }}{{ vm.total }}{{ m(' 条任务', ' tasks') }}</span></div>
      <MobileNotice v-if="vm.error" type="error" show-icon :message="vm.error" /><MobileNotice v-if="!vm.online" type="warning" :message="state.offlineMode ? '离线模式 · 检查结果保存在本机' : '当前无网络，仅展示本机任务'" />
      <div class="task-list"><TaskRow v-for="task in vm.rows" :key="task.id" :task="task" /></div>
      <van-loading v-if="vm.busy" class="loading" /><van-empty v-if="!vm.busy && !vm.rows.length && !vm.error" :description="m('暂无任务', 'No tasks')" />
      <van-button v-if="vm.rows.length < vm.total" block class="load-more" :loading="vm.busy" @click="vm.load(true)">{{ m('加载更多', 'Load more') }}</van-button>
    </template><van-empty v-else :description="m('暂无任务查看权限', 'No access to tasks')" />
    <MobileSheet v-model:show="drawer" title="筛选任务">
      <label class="field-label" for="from-date">{{ m('任务开始日期', 'Start date from') }}</label><input id="from-date" v-model="from" class="native-input" type="date" />
      <label class="field-label" for="to-date">{{ m('至', 'To') }}</label><input id="to-date" v-model="to" class="native-input" type="date" />
      <MobileNotice v-if="dateError" type="error" :message="dateError" /><van-button type="primary" block class="load-more" @click="applyDates">{{ m('确定', 'Apply') }}</van-button>
    </MobileSheet>
  </main>
</template>
