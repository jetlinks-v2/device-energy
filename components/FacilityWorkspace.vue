<script setup lang="ts">
import { FullPage } from '@jetlinks-web-core/layout'
</script>

<template>
  <j-page-container>
    <!-- 沿用公共基础模块的视口高度计算，滚动留在业务卡片内。 -->
    <FullPage flex class="facility-workspace">
      <slot />
    </FullPage>
  </j-page-container>
</template>
