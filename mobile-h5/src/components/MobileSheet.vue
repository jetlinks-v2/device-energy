<script setup lang="ts">
defineProps<{ show: boolean; title?: string; busy?: boolean }>()
const emit = defineEmits<{ 'update:show': [value: boolean] }>()
</script>
<template><van-popup teleport="body" :show="show" position="bottom" round safe-area-inset-bottom :close-on-click-overlay="!busy" :style="{ maxHeight: '85dvh', overflowY: 'auto' }" @update:show="!busy && emit('update:show', $event)"><van-nav-bar :title="title" :right-text="busy ? '' : '关闭'" @click-right="emit('update:show', false)" /><div class="mobile-sheet-body"><slot /></div></van-popup></template>
<style scoped>.mobile-sheet-body { padding: 16px; min-width: 0; }</style>
