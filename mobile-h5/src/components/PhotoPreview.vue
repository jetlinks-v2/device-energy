<script setup lang="ts">
import { reactive } from 'vue'
import { showImagePreview } from 'vant'
import { useFilePreview } from '../hooks/useFilePreview'
import { m } from '../services/mobileText'
const props = defineProps<{ id: string; removable?: boolean }>()
defineEmits<{ remove: [] }>()
const vm = reactive(useFilePreview(() => props.id))
</script>
<template>
  <div class="photo-preview">
    <van-image v-if="vm.url" :src="vm.url" :width="72" :height="72" :alt="m('现场照片', 'Site photo')" fit="cover" radius="8" @click="showImagePreview([vm.url])" />
    <button v-else-if="vm.error" class="photo-retry" :title="vm.error" :aria-label="m('重新加载图片', 'Reload image')" @click="vm.load"><van-icon name="replay" /></button><van-loading v-else />
    <button v-if="removable" class="photo-remove" :aria-label="m('移除照片', 'Remove photo')" @click="$emit('remove')"><van-icon name="cross" /></button>
  </div>
</template>
