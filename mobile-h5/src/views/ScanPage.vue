<script setup lang="ts">
import { reactive } from 'vue'
import { ScanOutlined } from '@ant-design/icons-vue'
import QrScanner from '../components/QrScanner.vue'
import { useScanRoute } from '../hooks/useScanRoute'
import { m } from '../services/mobileText'
const vm = reactive(useScanRoute())
</script>
<template>
  <main class="page scan-page"><div class="scan-target"><ScanOutlined /><h1>{{ vm.title }}</h1></div><QrScanner @code="vm.scan" /><a-spin v-if="vm.busy" class="loading" /><a-alert v-if="vm.error" type="error" :message="vm.error" /><a-collapse v-if="!vm.taskId" ghost><a-collapse-panel key="manual" :header="m('手动输入二维码内容', 'Enter QR contents manually')"><a-textarea v-model:value="vm.code" :rows="4" :placeholder="m('粘贴二维码内容', 'Paste QR contents')" /><a-button type="primary" block class="load-more" @click="vm.scan()">{{ m('查看', 'View') }}</a-button></a-collapse-panel></a-collapse></main>
</template>
