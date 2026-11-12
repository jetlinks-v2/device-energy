<script setup lang="ts">
import { reactive } from 'vue'
import FacilityWorkspace from '../../../components/FacilityWorkspace.vue'
import OverviewEnergy from '../../../components/overview/OverviewEnergy.vue'
import OverviewTasks from '../../../components/overview/OverviewTasks.vue'
import { useOverview } from '../../../hooks/useOverview'
import { feText } from '../../../shared/i18n'
import '../../../styles/overview.css'
const vm = reactive(useOverview())
const number = (value?: number) => value === undefined ? '—' : value.toLocaleString()
</script>

<template>
  <FacilityWorkspace>
    <section class="facility-page facility-overview">
      <a-select v-model:value="vm.projectId" :options="vm.projects" :placeholder="feText('allBusinessProjects')"
        :aria-label="feText('businessProject')" class="overview-project" show-search option-filter-prop="label" allow-clear @change="vm.changeProject" />
      <a-alert v-if="vm.error" type="error" :message="vm.error" show-icon>
        <template #action><a-button size="small" @click="vm.refresh">{{ feText('retry') }}</a-button></template>
      </a-alert>
      <a-spin :spinning="vm.busy">
        <div class="overview-grid">
          <OverviewTasks :state="vm.taskState" @navigate="vm.go" @changed="vm.refresh" />
          <section class="overview-panel">
            <header class="overview-section-head"><h2><AIcon type="HddOutlined" />{{ feText('overviewDevices') }}</h2>
              <a-button v-if="vm.can('devices')" type="link" @click="vm.go('devices')">{{ feText('deviceRegister') }}<AIcon type="RightOutlined" /></a-button>
            </header>
            <div class="overview-device-summary"><div class="overview-device-total">{{ number(vm.total) }}<span>{{ feText('totalDevices') }}</span></div>
              <a-tag v-if="vm.total && vm.total === vm.online" color="green">{{ feText('overviewAllOnline') }}</a-tag>
            </div>
            <a-progress :percent="vm.onlineRate || 0" :show-info="false" :stroke-width="8" stroke-color="var(--overview-blue)" />
            <div class="overview-device-legend"><span><i />{{ feText('online') }}<b>{{ number(vm.online) }}</b></span><span><i class="non-online" />{{ feText('overviewNonOnline') }}<b>{{ number(vm.nonOnline) }}</b></span></div>
            <div class="overview-device-footer"><span>{{ feText('overviewOnlineRate') }}</span><strong>{{ vm.onlineRate === undefined ? '—' : vm.onlineRate.toFixed(1) + '%' }}</strong></div>
            <div class="overview-entries">
              <a-button v-if="vm.can('energy')" @click="vm.go('energy', undefined, 'collection')"><AIcon type="ThunderboltOutlined" />{{ feText('collectionStatus') }}</a-button>
              <a-button v-if="vm.can('faults')" @click="vm.go('faults')"><AIcon type="ToolOutlined" />{{ feText('overviewFaultRecords') }}</a-button>
            </div>
          </section>
          <OverviewEnergy :rows="vm.rows" :ready="vm.ready" v-model:level="vm.level" :status="vm.energyStatus" @change="vm.refreshEnergy" />
        </div>
      </a-spin>
    </section>
  </FacilityWorkspace>
</template>
