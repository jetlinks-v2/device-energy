<script setup lang="ts">
import { computed, ref } from 'vue'
const props = defineProps<{ modelValue?: string; options: { value: string; label: string }[]; title?: string; disabled?: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: string] }>(), show = ref(false)
const columns = computed(() => props.options.map(option => ({ text: option.label, value: option.value })))
const label = computed(() => props.options.find(option => option.value === props.modelValue)?.label || '')
</script>
<template><van-field :model-value="label" readonly is-link :placeholder="title || '请选择'" :disabled="disabled" @click="!disabled && (show = true)" /><van-popup teleport="body" v-model:show="show" position="bottom" round safe-area-inset-bottom><van-picker :title="title" :columns="columns" :model-value="modelValue ? [modelValue] : []" @cancel="show = false" @confirm="emit('update:modelValue', String($event.selectedValues[0])); show = false" /></van-popup></template>
