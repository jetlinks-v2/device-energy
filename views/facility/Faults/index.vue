<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import ConditionFilter, { type ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter'
import FacilityWorkspace from '../../../components/FacilityWorkspace.vue'
import FaultDetail from '../../../components/faults/FaultDetail.vue'
import FaultAction from '../../../components/faults/FaultAction.vue'
import { useFaults } from '../../../hooks/useFaults'
import { faultState, faultStates, faultOverdue } from '../../../shared/faults'
import { taskTime } from '../../../shared/types'
import { feText } from '../../../shared/i18n'
import '../../../styles/operations.css'
const vm = reactive(useFaults()), filters = ref<ConditionFilterTerm[]>([])
const listPane = ref<HTMLElement>(), detailPane = ref<HTMLElement>()
watch(() => vm.selected?.id, () => detailPane.value?.scrollTo({ top: 0 }), { flush: 'post' })
watch(() => vm.page, () => listPane.value?.scrollTo({ top: 0 }), { flush: 'post' })
const fields = [
  { title: feText('faultName'), dataIndex: 'name', search: { type: 'string' as const } },
  { title: feText('deviceName'), dataIndex: 'deviceName', search: { type: 'string' as const } },
  { title: feText('faultRepairer'), dataIndex: 'assigneeName', search: { type: 'string' as const } }
]
</script>
<template>
  <FacilityWorkspace><section class="facility-page operations-workspace operations-master-detail">
    <div class="operations-search"><a-select v-model:value="vm.projectId" :options="vm.projects" :loading="vm.loading" :placeholder="feText('businessProject')" class="operations-project" />
      <ConditionFilter v-model="filters" :fields="fields" @change="vm.terms = $event.filter.terms" />
      <j-permission-button hasPermission="facility/Faults:save" type="primary" :disabled="!vm.projectId" @click="vm.open('create')"><AIcon type="PlusOutlined" />{{ feText('faultRegister') }}</j-permission-button></div>
    <a-alert v-if="vm.error" type="error" :message="vm.error" show-icon><template #action><a-button @click="vm.load">{{ feText('retry') }}</a-button></template></a-alert>
    <div class="operations-status"><a-radio-group v-model:value="vm.status" button-style="solid"><a-radio-button value="all">{{ feText('all') }}</a-radio-button><a-radio-button v-for="state in faultStates()" :key="state.value" :value="state.value">{{ state.label }}</a-radio-button></a-radio-group><a-checkbox v-model:checked="vm.mine">{{ feText('faultMyTodo') }}</a-checkbox><a-checkbox v-model:checked="vm.overdue">{{ feText('faultOnlyOverdue') }}</a-checkbox></div>
    <div class="operations-split"><a-spin :spinning="vm.busy" wrapper-class-name="operations-master"><div ref="listPane" class="operations-list" role="list">
      <button v-for="row in vm.rows" :key="row.id" class="operations-row" :class="{ selected: vm.selected?.id === row.id }" @click="vm.select(row)">
        <div class="operations-row-head"><strong>{{ row.name }}</strong><a-tag :color="faultState(row.state)?.color">{{ faultState(row.state)?.label }}</a-tag></div><p>{{ row.deviceName }}</p><div class="operations-meta"><a-tag v-if="row.priority === 'urgent'" color="red">{{ feText('faultUrgent') }}</a-tag><a-tag v-if="faultOverdue(row)" color="orange">{{ feText('faultOverdue') }}</a-tag><span>{{ row.assigneeName || feText('faultUnassigned') }}</span><span>{{ taskTime(row.deadline) }}</span></div>
      </button><a-empty v-if="!vm.rows.length && !vm.busy" :description="feText('faultEmpty')" /></div><a-pagination v-if="vm.total > 12" v-model:current="vm.page" :total="vm.total" :page-size="12" :show-size-changer="false" size="small" /></a-spin>
      <div ref="detailPane" class="operations-detail"><FaultDetail v-if="vm.selected" :row="vm.selected" :actions="vm.actions" :history="vm.history" :total="vm.historyTotal" :page="vm.historyPage" :busy="vm.detailBusy" @action="vm.open" @page="vm.selected && vm.select(vm.selected, $event)" /><a-empty v-else :description="feText('faultSelectDetail')" /></div>
    </div><FaultAction :vm="vm" />
  </section></FacilityWorkspace>
</template>
