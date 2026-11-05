<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import { reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useOwnerMeter } from '../hooks/useOwnerMeter'
import { state } from '../services/session'
import { time, energyNames } from '../../../shared/types'
import SeriesChart from '../../../components/SeriesChart.vue'
const vm = reactive(useOwnerMeter(String(useRoute().params.id)))
</script>
<template>
  <div class="page">
    <a-button @click="$router.push('/')">{{ feText('backToMyMeters') }}</a-button>
    <h2>{{ energyNames[vm.detail?.energyType || ''] }}{{ feText('energyDetails') }}</h2>
    <a-alert
      v-if="vm.error"
      :message="vm.error"
      type="error"
      show-icon
    />
    <a-space
      wrap
      class="toolbar"
    >
      <a-date-picker
        :placeholder="feText('startDate')"
        @change="(value) => (vm.from = Number(value?.valueOf()) || vm.from)"
      />
      <a-date-picker
        :placeholder="feText('endDate')"
        @change="(value) => (vm.to = Number(value?.valueOf()) || vm.to)"
      />
      <a-button
        :loading="vm.busy"
        @click="vm.refresh"
      >
        {{ feText('search') }}
      </a-button>
    </a-space>
    <a-spin :spinning="vm.busy">
      <a-card
        v-for="metric in vm.detail?.metrics"
        :key="metric.propertyId"
        class="task-card"
      >
        <h3>
          {{ metric.name }}
          <a-tag
            v-if="metric.stale"
            color="orange"
          >
            {{ feText('dataIsStaleOrNoValidReadingsAreAvailable') }}
          </a-tag>
        </h3>
        <a-statistic
          :title="metric.kind === 'balance' ? feText('actualDeviceBalanceRemainingQuantity') : feText('latestReading')"
          :value="metric.readings.at(-1)?.value ?? feText('noData')"
          :suffix="metric.unit"
        />
        <p class="muted">{{ time(metric.readings.at(-1)?.time) }}</p>
        <p v-if="metric.usage">
          {{ feText('usageForPeriod') }}{{ metric.usage.value }} {{ metric.unit }}
          <a-tag
            v-if="!metric.usage.complete"
            color="orange"
          >
            {{ feText('incompleteData') }}
          </a-tag>
        </p>
        <SeriesChart :values="metric.readings" />
      </a-card>
      <a-empty
        v-if="vm.detail && !vm.detail.metrics.length"
        :description="feText('noCollectedData')"
      />
    </a-spin>
    <a-card
      :title="feText('paymentEnquiries')"
      class="task-card"
    >
      <p>{{ feText('ifYouReceiveALowBalanceReminderContactPropertyManagementToArrange') }}</p>
      <a
        v-if="state.config.propertyTelephone"
        :href="'tel:' + state.config.propertyTelephone"
      >
        {{ feText('contactPropertyManagement') }} {{ state.config.propertyTelephone }}
      </a>
      <p v-else>{{ feText('pleaseContactThePropertyServiceCenterForYourProject') }}</p>
    </a-card>
  </div>
</template>
