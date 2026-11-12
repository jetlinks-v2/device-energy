<script setup lang="ts">
import { ref as collapseRef } from 'vue'
const expanded = collapseRef<string[]>([])
import { reactive } from 'vue'
import QrScanner from '../components/QrScanner.vue'
import { useScanRoute } from '../hooks/useScanRoute'
import { m } from '../services/mobileText'
const vm = reactive(useScanRoute())
</script>
<template>
  <main class="page scan-page"><div class="scan-target"><van-icon name="scan" /><h1>{{ vm.title }}</h1></div><QrScanner @code="vm.scan" /><van-loading v-if="vm.busy" class="loading" /><MobileNotice v-if="vm.error" type="error" :message="vm.error" /><van-collapse v-model="expanded" v-if="!vm.taskId" ghost><van-collapse-item name="manual" :title="m('手动输入二维码内容', 'Enter QR contents manually')"><van-field type="textarea" v-model="vm.code" :rows="4" :placeholder="m('粘贴二维码内容', 'Paste QR contents')" /><van-button type="primary" block class="load-more" @click="vm.scan()">{{ m('查看', 'View') }}</van-button></van-collapse-item></van-collapse></main>
</template>
