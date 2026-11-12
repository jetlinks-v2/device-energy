<script setup lang="ts">
import { onMounted, reactive, ref } from 'vue'
import { useSession } from '../hooks/useSession'
const vm = reactive(useSession())
const passwordVisible = ref(false)
onMounted(() => void vm.reloadCaptcha())
</script>
<template>
  <section class="login-page">
    <header class="login-brand"><span class="login-mark"><van-icon name="setting-o" /></span><span>设施设备</span></header>
    <div class="login-content">
      <h1>账号登录</h1>
      <MobileNotice v-if="vm.error" :message="vm.error" type="error" />
      <van-form @submit="vm.login" :disabled="vm.loading" class="login-form">
        <van-field v-model="vm.form.tenantDomain" label="项目编码" label-align="top" name="tenantDomain" autocomplete="organization" placeholder="请输入项目编码" :rules="[{ required: true, message: '请填写项目编码' }]" />
        <van-field v-model="vm.form.username" label="账号" label-align="top" name="username" autocomplete="username" autocapitalize="none" :spellcheck="false" placeholder="请输入账号" :rules="[{ required: true, message: '请填写账号' }]" />
        <van-field v-model="vm.form.password" :type="passwordVisible ? 'text' : 'password'" label="密码" label-align="top" name="password" autocomplete="current-password" placeholder="请输入密码" :rules="[{ required: true, message: '请填写密码' }]">
          <template #button><button type="button" class="password-toggle" :aria-label="passwordVisible ? '隐藏密码' : '显示密码'" :aria-pressed="passwordVisible" @click="passwordVisible = !passwordVisible"><van-icon :name="passwordVisible ? 'eye-o' : 'closed-eye'" /></button></template>
        </van-field>
        <van-field v-if="vm.captcha" v-model="vm.form.verifyCode" label="验证码" label-align="top" name="verifyCode" maxlength="8" autocomplete="off" placeholder="请输入验证码" :rules="[{ required: true, message: '请填写验证码' }]"><template #button><button type="button" class="captcha-refresh" aria-label="刷新验证码" @click="vm.reloadCaptcha"><img :src="vm.captcha" alt="图片验证码" /></button></template></van-field>
        <van-button type="primary" native-type="submit" block :loading="vm.loading" loading-text="登录中" class="login-submit">登录</van-button>
      </van-form>
    </div>
  </section>
</template>
<style scoped>
.login-page { min-height: 100dvh; padding: max(36px, env(safe-area-inset-top)) 28px max(32px, env(safe-area-inset-bottom)); background: linear-gradient(180deg, #eaf5ff, #fff 38%); }
.login-brand { display: flex; align-items: center; gap: 10px; color: var(--sky-strong); font-size: 18px; font-weight: 650; }
.login-mark { display: grid; place-items: center; width: 36px; height: 36px; border-radius: 10px; background: var(--sky-strong); color: var(--surface); font-size: 22px; }
.login-content { margin-top: clamp(36px, 8dvh, 72px); }
.login-content h1 { margin-bottom: 26px; font-size: 28px; font-weight: 650; }
.login-form { display: grid; gap: 20px; }
.login-form :deep(.van-field) { display: block; padding: 0; background: transparent; overflow: visible; }
.login-form :deep(.van-cell::after) { display: none; }
.login-form :deep(.van-field__label) { width: auto; margin: 0 0 8px; color: var(--ink); font-size: 14px; }
.login-form :deep(.van-field__body) { min-height: 50px; padding: 0 14px; background: var(--canvas); border: 1px solid transparent; border-radius: 10px; }
.login-form :deep(.van-field__body:focus-within) { border-color: var(--sky); background: var(--surface); }
.login-form :deep(.van-field__control) { min-height: 48px; font-size: 16px; }
.login-form :deep(.van-field__control::placeholder) { color: var(--muted); }
.login-form :deep(.van-field__error-message) { margin-top: 5px; }
.login-submit { margin-top: 8px; height: 50px; border-radius: 10px; font-size: 16px; font-weight: 600; }
.password-toggle, .captcha-refresh { display: grid; place-items: center; min-width: 44px; min-height: 44px; border: 0; padding: 0; color: var(--muted); background: transparent; }
.password-toggle { margin-right: -10px; font-size: 21px; }
.captcha-refresh img { display: block; width: 96px; height: 38px; object-fit: contain; border-radius: 4px; }
@media (max-height: 680px) { .login-content { margin-top: 28px; }.login-form { gap: 14px; }.login-content h1 { margin-bottom: 20px; } }
@media (max-width: 350px) { .login-page { padding-inline: 22px; } }
</style>
