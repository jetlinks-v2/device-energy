<script setup lang="ts">
withDefaults(defineProps<{ message: string; type?: string; showIcon?: boolean }>(), { type: 'info' })
</script>
<template><div class="mobile-notice" :data-type="type" :role="type === 'error' ? 'alert' : 'status'"><van-icon :name="type === 'error' ? 'warning-o' : 'info-o'" /><span>{{ message }}</span><slot name="action" /></div></template>
<style scoped>
.mobile-notice { display: flex; align-items: center; gap: 9px; padding: 12px; border-radius: 10px; background: #eaf5ff; color: #155d8c; margin-bottom: 12px; font-size: 14px; line-height: 1.6; }.mobile-notice > span { flex: 1; overflow-wrap: anywhere; }.mobile-notice[data-type='error'] { background: #fff0ed; color: #a82c2a; }.mobile-notice[data-type='warning'] { background: #fff6e8; color: #87520d; }.mobile-notice .van-icon { font-size: 19px; flex-shrink: 0; }
</style>
