<script setup lang="ts">
import { computed } from 'vue'
import { showConfirmDialog } from 'vant'
const confirmLogout = () => showConfirmDialog({ title: '退出当前账号？' }).then(() => logout()).catch(() => {})
import { state, can, canMessage } from '../services/session'
import { useSession } from '../hooks/useSession'
import { projects } from '../hooks/useProjects'
import { m } from '../services/mobileText'
import OfflineModeControl from '../components/OfflineModeControl.vue'
const { logout } = useSession()
const projectName = computed(() => projects.value.find(p => p.id === state.projectId)?.name)
</script>
<template>
  <main class="page profile-page">
    <section class="profile-summary"><span class="profile-avatar"><van-icon name="user-o" /></span><div class="profile-identity"><h2>{{ state.context?.userName || state.authorization?.user.name }}</h2><p v-if="projectName" class="profile-project"><van-icon name="location-o" /><span>{{ projectName }}</span></p></div></section>
    <div class="settings">
      <OfflineModeControl v-if="can('save')" />
      <router-link v-if="can('review')" class="setting-row" to="/tasks?mode=review"><span class="setting-icon blue"><van-icon name="todo-list-o" /></span><span>{{ m('我的审批', 'My reviews') }}</span><van-icon name="arrow" /></router-link>
      <router-link v-if="canMessage()" class="setting-row" to="/messages"><span class="setting-icon teal"><van-icon name="bell" /></span><span>消息</span><van-icon name="arrow" /></router-link>
    </div>
    <button class="profile-logout" @click="confirmLogout"><van-icon name="revoke" /><span>{{ m('退出登录', 'Sign out') }}</span></button>
  </main>
</template>
