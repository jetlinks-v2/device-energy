<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import { reactive } from 'vue'
import { useScanner } from '../hooks/useScanner'
const emit = defineEmits<{ code: [code: string] }>(),
  vm = reactive(useScanner((code) => emit('code', code)))
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
      <label>
        {{ feText('readQrCodeImage') }}
        <input
          type="file"
          accept="image/*"
          @change="vm.scanImage"
        />
      </label>
    </a-space>
  </div>
</template>
