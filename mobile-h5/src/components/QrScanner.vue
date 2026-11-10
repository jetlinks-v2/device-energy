<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import { reactive, ref } from 'vue'
import { PictureOutlined } from '@ant-design/icons-vue'
import { useScanner } from '../hooks/useScanner'
const emit = defineEmits<{ code: [code: string] }>(),
  vm = reactive(useScanner((code) => emit('code', code)))
const fileInput = ref<HTMLInputElement>()
</script>
<template>
  <div>
    <a-alert
      v-if="vm.error"
      :message="vm.error"
      type="warning"
    />
    <video
      :ref="vm.setVideo"
      playsinline
      muted
      :style="{ display: vm.active ? 'block' : 'none', width: '100%' }"
    />
    <a-space>
      <a-button
        v-if="!vm.active"
        @click="vm.start"
      >
        {{ feText('openCameraToScan') }}
      </a-button>
      <a-button
        v-else
        @click="vm.stop"
      >
        {{ feText('stopScanning') }}
      </a-button>
      <a-button @click="fileInput?.click()">
        <PictureOutlined />
        {{ feText('readQrCodeImage') }}
      </a-button>
      <input
        ref="fileInput"
        hidden
        type="file"
        accept="image/*"
        @change="vm.scanImage"
      />
    </a-space>
  </div>
</template>
