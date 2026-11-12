<script setup lang="ts">
import { useAttachmentImages } from '../../hooks/useAttachmentImages'
const props = defineProps<{ ids: string[] }>()
const images = useAttachmentImages(() => props.ids)
</script>
<template>
  <a-image-preview-group><a-space wrap><template v-for="(photo, key) in images" :key="key">
    <a-image v-if="photo.url" :src="photo.url" :width="88" :height="88" style="object-fit: cover; border-radius: 8px" />
    <a-tooltip v-else-if="photo.error" :title="photo.error"><span>图片加载失败</span></a-tooltip><a-spin v-else />
  </template></a-space></a-image-preview-group>
</template>
