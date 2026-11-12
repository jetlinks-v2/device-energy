<script setup lang="ts">
import dayjs from 'dayjs'
import type { useFaults } from '../../hooks/useFaults'
import type { UnwrapNestedRefs } from 'vue'
import { faultActionText, faultCategories } from '../../shared/faults'
import { feText } from '../../shared/i18n'
import AttachmentsEditor from '../AttachmentsEditor.vue'
defineProps<{ vm: UnwrapNestedRefs<ReturnType<typeof useFaults>> }>()
</script>
<template>
  <a-modal :open="!!vm.action" :title="faultActionText(vm.action)" :width="vm.action === 'create' ? 680 : 520" :confirm-loading="vm.actionBusy" :mask-closable="false" :closable="!vm.actionBusy" :body-style="{ maxHeight: 'calc(100dvh - 220px)', overflowY: 'auto' }" @cancel="vm.action = ''" @ok="vm.confirm">
    <a-alert v-if="vm.actionError" type="error" :message="vm.actionError" show-icon style="margin-bottom: 16px" /><a-form layout="vertical">
      <template v-if="vm.action === 'create'">
        <a-form-item :label="feText('deviceName')" required><a-select v-model:value="vm.form.deviceId" show-search :filter-option="false" :options="vm.devices" @search="vm.searchDevices" /></a-form-item>
        <a-form-item :label="feText('faultName')"><a-input v-model:value="vm.form.name" :maxlength="256" :placeholder="feText('faultAutoName')" /></a-form-item>
        <a-form-item :label="feText('faultDescription')" required><a-textarea v-model:value="vm.form.description" :rows="3" :maxlength="4000" show-count /></a-form-item>
        <div class="fault-form-grid"><a-form-item :label="feText('faultPriority')" required><a-radio-group v-model:value="vm.form.priority"><a-radio value="normal">{{ feText('faultNormal') }}</a-radio><a-radio value="urgent">{{ feText('faultUrgent') }}</a-radio></a-radio-group></a-form-item>
          <a-form-item :label="feText('faultCategory')"><a-select v-model:value="vm.form.category" :options="faultCategories()" /></a-form-item>
          <a-form-item :label="feText('faultDeadline')" required><a-date-picker :value="vm.form.deadline ? dayjs(vm.form.deadline) : undefined" show-time style="width:100%" @change="vm.form.deadline = $event ? Number($event.valueOf()) : undefined" /></a-form-item>
          <a-form-item :label="feText('faultReviewer')" required><a-select v-model:value="vm.form.reviewerId" :options="vm.people" show-search option-filter-prop="label" /></a-form-item>
          <a-form-item v-if="vm.canDispatch" :label="feText('faultRepairer')"><a-select v-model:value="vm.form.assigneeId" :options="vm.people.filter(person => person.value !== vm.form.reviewerId)" allow-clear show-search option-filter-prop="label" /></a-form-item></div>
      </template>
      <template v-else><p>{{ vm.selected?.name }}</p><a-form-item v-if="['dispatch', 'transfer', 'reviewer'].includes(vm.action)" :label="feText(vm.action === 'reviewer' ? 'faultReviewer' : 'faultRepairer')" required><a-select v-model:value="vm.form.userId" :options="vm.people.filter(person => person.value !== vm.selected?.reviewerId && person.value !== vm.selected?.assigneeId)" show-search option-filter-prop="label" /></a-form-item>
        <a-form-item v-if="!['claim', 'start'].includes(vm.action)" :label="feText(vm.action === 'resolve' ? 'faultResolution' : vm.action === 'close' ? 'faultCloseReason' : 'faultActionComment')" :required="['resolve', 'reject', 'transfer', 'reviewer', 'close'].includes(vm.action)"><a-textarea v-model:value="vm.form.comment" :rows="4" :maxlength="4000" show-count /></a-form-item></template>
      <a-form-item v-if="['create', 'resolve'].includes(vm.action)" :label="feText('faultPhotos')"><AttachmentsEditor :ids="vm.form.attachments" :project-id="vm.projectId" @change="vm.form.attachments = $event" /></a-form-item>
    </a-form>
  </a-modal>
</template>
