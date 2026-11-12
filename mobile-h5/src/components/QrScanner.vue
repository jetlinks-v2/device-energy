<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import { reactive, ref } from 'vue'
import { useScanner } from '../hooks/useScanner'
const emit = defineEmits<{ code: [code: string] }>(),
  vm = reactive(useScanner((code) => emit('code', code)))
const fileInput = ref<HTMLInputElement>()
</script>
<template>
  <div>
    <MobileNotice
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
    <van-space>
      <van-button
        v-if="!vm.active"
        @click="vm.start"
      >
        {{ feText('openCameraToScan') }}
      </van-button>
      <van-button
        v-else
        @click="vm.stop"
      >
        {{ feText('stopScanning') }}
      </van-button>
      <van-button @click="fileInput?.click()">
        <van-icon name="photo-o" />
        {{ feText('readQrCodeImage') }}
      </van-button>
      <input
        ref="fileInput"
        hidden
        type="file"
        accept="image/*"
        @change="vm.scanImage"
      />
    </van-space>
  </div>
</template>
