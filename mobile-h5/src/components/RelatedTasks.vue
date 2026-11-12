<script setup lang="ts">
import { reactive } from 'vue'
import { useRelatedTasks } from '../hooks/useRelatedTasks'
import { display } from '../../../shared/types'
import { m } from '../services/mobileText'
import TaskRow from './TaskRow.vue'
const props = defineProps<{ type: 'devices' | 'groups'; id: string }>()
const vm = reactive(useRelatedTasks(props.type, props.id))
</script>
<template>
  <main class="page"><MobileNotice v-if="vm.error" type="error" :message="vm.error"><template #action><van-button class="mobile-text-button" plain @click="vm.load()">{{ m('重试', 'Retry') }}</van-button></template></MobileNotice>
    <section v-if="vm.entity" class="task-overview"><span class="status">{{ type === 'groups' ? m('设备组', 'Device group') : display(vm.entity.sourceState) }}</span><h1>{{ vm.entity.name }}</h1><dl class="task-facts"><div><dt>{{ m('项目', 'Project') }}</dt><dd>{{ vm.entity.projectName || '—' }}</dd></div><div><dt>{{ m('位置', 'Location') }}</dt><dd>{{ vm.entity.location || '—' }}</dd></div><div v-if="type === 'devices'"><dt>{{ m('设备分类', 'Category') }}</dt><dd>{{ vm.entity.categoryName || '—' }}</dd></div><div v-if="type === 'devices'"><dt>{{ m('规格型号', 'Model') }}</dt><dd>{{ vm.entity.specification || '—' }}</dd></div></dl></section>
    <div class="section-heading"><h2>{{ m('相关任务', 'Related tasks') }}</h2><span>{{ vm.total }}</span></div><div class="task-list"><TaskRow v-for="task in vm.tasks" :key="task.id" :task="task" /></div><van-loading v-if="vm.busy" class="loading" /><van-empty v-if="!vm.busy && !vm.tasks.length && !vm.error" :description="m('暂无相关任务', 'No related tasks')" /><van-button v-if="vm.tasks.length < vm.total" block class="load-more" :loading="vm.busy" @click="vm.load(true)">{{ m('加载更多', 'Load more') }}</van-button>
  </main>
</template>
