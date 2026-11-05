<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import { reactive } from 'vue'
import QrScanner from '../components/QrScanner.vue'
import { useHome } from '../hooks/useHome'
import { display, time } from '../../../shared/types'
const vm = reactive(useHome())
</script>
<template>
  <div class="page">
    <a-alert
      v-if="!vm.online"
      :message="feText('workingOfflineSubmitThroughTheSyncCenterWhenConnected')"
      type="warning"
    />
    <a-alert
      v-if="vm.error"
      :message="vm.error"
      type="error"
      show-icon
    />
    <a-tabs>
      <a-tab-pane
        v-if="vm.can('facility-task')"
        key="tasks"
        :tab="feText('myTasks')"
      >
        <a-space class="toolbar">
          <a-switch
            v-model:checked="vm.pool"
            :checked-children="feText('taskPool')"
            :un-checked-children="feText('myTasks')"
            @change="vm.refresh"
          />
          <a-button
            :loading="vm.busy"
            @click="vm.refresh"
          >
            {{ feText('refresh') }}
          </a-button>
        </a-space>
        <a-card
          v-for="task in vm.tasks"
          :key="task.id"
          class="task-card"
          @click="$router.push('/tasks/' + task.id)"
        >
          <a-tag>{{ display(task.kind) }}</a-tag>
          <a-tag>{{ display(task.state) }}</a-tag>
          <h3>{{ task.name }}</h3>
          <p>{{ task.deviceName }}</p>
          <p class="muted">{{ feText('due') }} {{ time(task.deadline) }}</p>
        </a-card>
        <a-empty
          v-if="!vm.tasks.length && !vm.busy"
          :description="feText('noTasksAvailable')"
        />
      </a-tab-pane>
      <a-tab-pane
        v-if="vm.can('facility-task')"
        key="scan"
        :tab="feText('scanToView')"
      >
        <QrScanner
          @code="
            (code) => {
              vm.code = code
              vm.scan()
            }
          "
        />
        <p>{{ feText('orPasteTheQrCodeContents') }}</p>
        <a-textarea
          v-model:value="vm.code"
          :placeholder="feText('deviceQrCodeContents')"
        />
        <a-button
          type="primary"
          style="margin-top: 16px"
          @click="vm.scan"
        >
          {{ feText('viewDevice') }}
        </a-button>
      </a-tab-pane>
      <a-tab-pane
        v-if="vm.can('facility-task')"
        key="sync"
        :tab="feText('syncCenter')"
      >
        <a-button
          :loading="vm.busy"
          :disabled="!vm.online"
          @click="vm.replay"
        >
          {{ feText('syncPendingSubmissions') }}
        </a-button>
        <a-card
          v-for="row in vm.pending"
          :key="row.id"
          class="task-card"
        >
          <a-tag :color="row.state === 'conflict' ? 'red' : row.state === 'submitted' ? 'green' : 'orange'">
            {{ row.state === 'conflict' ? feText('taskConflict') : row.state === 'submitted' ? feText('submitted') : feText('pendingSync') }}
          </a-tag>
          <p>{{ time(row.createdAt) }}</p>
          <p>{{ row.error }}</p>
          <a-collapse v-if="row.state === 'conflict'">
            <a-collapse-panel
              key="local"
              :header="feText('viewRetainedLocalContent')"
            >
              <p
                v-for="result in row.command.results"
                :key="result.itemId"
              >
                {{ result.itemId }}：{{ result.value }} {{ result.remark }}
              </p>
            </a-collapse-panel>
          </a-collapse>
          <a-popconfirm
            v-if="row.state === 'submitted'"
            :title="feText('clearThisSubmissionRecord')"
            @confirm="vm.remove(row.id)"
          >
            <a-button type="link">{{ feText('clearRecord') }}</a-button>
          </a-popconfirm>
        </a-card>
        <a-empty
          v-if="!vm.pending.length"
          :description="feText('noRecordsPendingSync')"
        />
      </a-tab-pane>
      <a-tab-pane
        v-if="vm.can('facility-owner')"
        key="meters"
        :tab="feText('myMeters')"
      >
        <a-button
          :loading="vm.busy"
          @click="vm.refresh"
        >
          {{ feText('refreshReadings') }}
        </a-button>
        <a-card
          v-for="meter in vm.meters"
          :key="meter.bindingId"
          class="task-card"
          @click="$router.push('/meters/' + meter.bindingId)"
        >
          <a-tag>{{ meter.current ? feText('currentMeter') : feText('pastBinding') }}</a-tag>
          <h3>{{ meter.name }}</h3>
          <p>{{ time(meter.startTime) }} {{ feText('to') }} {{ meter.endTime ? time(meter.endTime) : feText('present') }}</p>
        </a-card>
        <a-empty
          v-if="!vm.meters.length && !vm.busy"
          :description="feText('noMetersBoundPleaseContactPropertyManagement')"
        />
      </a-tab-pane>
      <a-tab-pane
        v-if="vm.can('facility-owner')"
        key="messages"
        :tab="feText('alertMessages')"
      >
        <a-card
          v-for="message in vm.messages"
          :key="message.id"
          class="task-card"
        >
          <h3>{{ message.title }}</h3>
          <p>{{ message.message }}</p>
          <p class="muted">{{ time(message.createTime) }}</p>
        </a-card>
        <a-empty
          v-if="!vm.messages.length"
          :description="feText('noMessages')"
        />
      </a-tab-pane>
    </a-tabs>
  </div>
</template>
