<script setup lang="ts">
import { feLocale, setFeLocale, feText } from '../../shared/i18n'
import enUS from 'ant-design-vue/es/locale/en_US'
import zhCN from 'ant-design-vue/es/locale/zh_CN'
import { state } from './services/session'
import { useSession } from './hooks/useSession'
const { logout } = useSession()
</script>
<template>
  <a-config-provider :locale="feLocale() === 'en' ? enUS : zhCN">
  <div class="app">
    <header>
      <strong>{{ feText('facilityAndEnergyManagement') }}</strong>
      <a-button type="text" @click="setFeLocale(feLocale() === 'en' ? 'zh' : 'en')">{{ feLocale() === 'en' ? '中文' : 'English' }}</a-button>
      <a-button
        v-if="state.session"
        type="text"
        @click="logout"
      >
        {{ feText('signOut') }}
      </a-button>
    </header>
    <router-view />
  </div>
</a-config-provider>
</template>
