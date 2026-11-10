<script setup lang="ts">
import { reactive } from 'vue'
import { useOwnerHome } from '../hooks/useOwnerHome'
import { taskTime } from '../../../shared/types'
import { m } from '../services/mobileText'
const vm = reactive(useOwnerHome())
</script>
<template>
  <main class="page"><a-alert v-if="vm.error" type="error" :message="vm.error" /><a-button :loading="vm.busy" @click="vm.load">{{ m('更新数据', 'Reload') }}</a-button><h2 class="section-heading">{{ m('我的表计', 'My meters') }}</h2><div class="settings"><router-link v-for="meter in vm.meters" :key="meter.bindingId" class="setting-row" :to="'/meters/' + encodeURIComponent(meter.bindingId)"><span>{{ meter.name }}</span><span class="status">{{ meter.current ? m('当前绑定', 'Current') : m('历史绑定', 'Past') }}</span></router-link></div><a-empty v-if="!vm.busy && !vm.meters.length" :description="m('暂无绑定表计', 'No bound meters')" /><h2 class="section-heading">{{ m('消息', 'Messages') }}</h2><article v-for="message in vm.messages" :key="message.id" class="detail-section"><h3>{{ message.title }}</h3><p>{{ message.message }}</p><p class="muted">{{ taskTime(message.createTime) }}</p></article><a-empty v-if="!vm.busy && !vm.messages.length" :description="m('暂无消息', 'No messages')" /></main>
</template>
