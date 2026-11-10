<script setup lang="ts">
import { computed, ref } from 'vue'
import { DownOutlined, CheckOutlined, EnvironmentOutlined } from '@ant-design/icons-vue'
import { projects, selectProject, projectError, loadProjects } from '../hooks/useProjects'
import { state } from '../services/session'
import { m } from '../services/mobileText'
const open = ref(false), search = ref('')
const label = computed(() => projects.value.find(p => p.id === state.projectId)?.name || m('选择项目', 'Select project'))
const filtered = computed(() => projects.value.filter(p => p.name?.toLowerCase().includes(search.value.toLowerCase())))
function choose(id: string) { selectProject(id); open.value = false }
</script>
<template>
  <button class="project-picker" :aria-label="'选择项目，当前：' + label" @click="open = true"><EnvironmentOutlined /><span>{{ label }}</span><DownOutlined /></button>
  <a-drawer v-model:open="open" :title="m('选择项目', 'Select project')" placement="bottom" height="70dvh" class="mobile-drawer">
    <a-input-search v-model:value="search" :placeholder="m('搜索项目', 'Search projects')" allow-clear />
    <a-alert v-if="projectError" type="error" :message="projectError"><template #action><a-button @click="loadProjects">{{ m('重试', 'Retry') }}</a-button></template></a-alert>
    <div class="choice-list" role="group" aria-label="单选项目">
      <button v-for="p in filtered" :key="p.id" :class="{ selected: state.projectId === p.id }" :aria-pressed="state.projectId === p.id" @click="choose(p.id)"><span>{{ p.name }}</span><CheckOutlined v-if="state.projectId === p.id" /></button>
      <a-empty v-if="!filtered.length" :description="m('暂无项目', 'No projects')" />
    </div>
  </a-drawer>
</template>
