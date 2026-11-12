<script setup lang="ts">
import { reactive } from 'vue'
import { useFaultWork } from '../hooks/useFaultWork'
import { faultOverdue, faultState } from '../../../shared/faults'
import { taskTime } from '../../../shared/types'
const vm = reactive(useFaultWork())
</script>
<template><main class="page">
  <van-search v-model="vm.search" placeholder="搜索维修任务" @search="vm.load()" @clear="vm.load()" />
  <van-tabs v-model:active="vm.status" shrink><van-tab title="待处理" name="active" /><van-tab title="待验收" name="review" /><van-tab title="已完成" name="closed" /><van-tab title="全部" name="all" /></van-tabs>
  <MobileNotice v-if="vm.error" :message="vm.error" type="error" /><MobileNotice v-if="!vm.online" message="维修任务需联网处理，请先恢复网络" />
  <div class="task-list" style="margin-top:16px"><router-link v-for="row in vm.rows" :key="row.id" :to="'/faults/' + encodeURIComponent(row.id)" class="task-row"><div class="task-row-top"><van-tag :type="faultOverdue(row) ? 'warning' : 'primary'">{{ faultState(row.state)?.label }}</van-tag><van-tag v-if="row.priority === 'urgent'" type="danger">紧急</van-tag></div><strong>{{ row.name }}</strong><p>{{ row.deviceName }}</p><div class="task-project">{{ row.projectName }}</div><div class="task-window">处理期限 {{ taskTime(row.deadline) }}</div></router-link></div>
  <van-loading v-if="vm.busy" class="loading" /><van-empty v-else-if="!vm.rows.length" description="暂无维修任务" /><van-button v-if="vm.rows.length < vm.total" block class="load-more" :loading="vm.busy" @click="vm.load(true)">加载更多</van-button>
</main></template>
