<script setup lang="ts">
import { computed } from 'vue'
import { UserOutlined, RightOutlined, EnvironmentOutlined, BellOutlined, LogoutOutlined, AuditOutlined } from '@ant-design/icons-vue'
import { state, can } from '../services/session'
import { useSession } from '../hooks/useSession'
import { projects } from '../hooks/useProjects'
import { m } from '../services/mobileText'
import OfflineModeControl from '../components/OfflineModeControl.vue'
const { logout } = useSession()
const projectName = computed(() => projects.value.find(p => p.id === state.projectId)?.name)
</script>
<template>
  <main class="page profile-page">
    <section class="profile-summary"><span class="profile-avatar"><UserOutlined /></span><div class="profile-identity"><h2>{{ state.context?.userName || state.authorization?.user.name }}</h2><p v-if="projectName" class="profile-project"><EnvironmentOutlined /><span>{{ projectName }}</span></p></div></section>
    <div class="settings">
      <OfflineModeControl v-if="can('save')" />
      <router-link v-if="can('review')" class="setting-row" to="/tasks?mode=review"><span class="setting-icon blue"><AuditOutlined /></span><span>{{ m('我的审批', 'My reviews') }}</span><RightOutlined /></router-link>
      <router-link v-if="can('query')" class="setting-row" to="/messages"><span class="setting-icon teal"><BellOutlined /></span><span>消息</span><RightOutlined /></router-link>
    </div>
    <a-popconfirm :title="m('退出当前账号？', 'Sign out?')" @confirm="logout"><button class="profile-logout"><LogoutOutlined /><span>{{ m('退出登录', 'Sign out') }}</span></button></a-popconfirm>
  </main>
</template>
