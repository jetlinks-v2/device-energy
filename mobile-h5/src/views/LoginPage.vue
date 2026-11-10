<script setup lang="ts">
import { feText } from '../../../shared/i18n'
import { onMounted, reactive } from 'vue'
import { ToolOutlined } from '@ant-design/icons-vue'
import { useSession } from '../hooks/useSession'
const vm = reactive(useSession())
onMounted(() => void vm.reloadCaptcha())
</script>
<template>
  <section class="login-page">
    <div class="login-brand">
      <ToolOutlined />
      {{ feText('facilityAndEnergyManagement') }}
    </div>
    <div class="panel">
      <h1>{{ feText('signInWithYourAccount') }}</h1>
      <a-alert
        v-if="vm.error"
        :message="vm.error"
        type="error"
        show-icon
      />
      <a-form
        layout="vertical"
        :model="vm.form"
        @finish="vm.login"
      >
        <a-form-item
          :label="feText('projectCode')"
          name="tenantDomain"
          :rules="[{ required: true, message: feText('enterProjectCode') }]"
        >
          <a-input
            v-model:value="vm.form.tenantDomain"
            autocomplete="organization"
          />
        </a-form-item>
        <a-form-item
          :label="feText('account')"
          name="username"
          :rules="[{ required: true, message: feText('enterAccount') }]"
        >
          <a-input
            v-model:value="vm.form.username"
            autocomplete="username"
          />
        </a-form-item>
        <a-form-item
          :label="feText('password')"
          name="password"
          :rules="[{ required: true, message: feText('enterPassword') }]"
        >
          <a-input-password
            v-model:value="vm.form.password"
            autocomplete="current-password"
          />
        </a-form-item>
        <a-form-item
          v-if="vm.captcha"
          :label="feText('verificationCode')"
          name="verifyCode"
          :rules="[{ required: true, message: feText('enterVerificationCode') }]"
        >
          <div class="captcha-row">
            <a-input
              v-model:value="vm.form.verifyCode"
              autocomplete="off"
              :maxlength="8"
            />
            <button
              type="button"
              :aria-label="feText('refreshVerificationCode')"
              @click="vm.reloadCaptcha"
            >
              <img
                :src="vm.captcha"
                :alt="feText('imageVerificationCode')"
              />
            </button>
          </div>
        </a-form-item>
        <a-button
          type="primary"
          html-type="submit"
          block
          :loading="vm.loading"
          size="large"
        >
          {{ feText('signIn') }}
        </a-button>
      </a-form>
    </div>
  </section>
</template>
