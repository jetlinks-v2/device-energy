<script setup lang="ts" generic="Row extends object">
import { computed } from 'vue'
import { display, type Query } from '../shared/types'
import { localTablePage } from '../shared/tableQuery'

interface Column {
  title: string
  key?: string
  dataIndex?: string
  width?: number
}
const props = withDefaults(defineProps<{
  dataSource: Row[]
  columns: Column[]
  rowKey?: string | ((row: Row) => string)
  loading?: boolean
  pagination?: boolean
}>(), { rowKey: 'id', pagination: true })
const columns = computed(() => props.columns.map(column => ({
  // 列插槽加前缀，避免 title 等业务字段触发 Ant Table 的同名区域插槽。
  ...column, key: 'cell-' + (column.key || column.dataIndex), dataIndex: column.dataIndex || column.key,
  scopedSlots: true, width: column.width || 160
})))
// 静态统计结果也交给平台表格分页，不能把整个数组当作一页传入。
const params = computed(() => ({ records: props.dataSource }))
const request = async (query: Query) => ({ success: true, result: localTablePage(props.dataSource, query) })
</script>

<template>
  <j-pro-table
    class="facility-data-table"
    mode="TABLE"
    type="PAGE"
    :columns="columns"
    :row-key="rowKey"
    :request="pagination ? request : undefined"
    :params="params"
    :data-source="pagination ? undefined : dataSource"
    :loading="loading"
    :no-pagination="!pagination"
    :pagination="{ pageSize: 12 }"
    :scroll="{ x: columns.reduce((width, column) => width + column.width, 0), y: false }"
    :alert-show="false"
    :body-style="{ padding: 0 }"
  >
    <template v-for="column in columns" :key="column.key" #[column.key]="record">
      <slot name="bodyCell" :column="{ ...column, key: column.dataIndex }" :record="record">
        {{ display(record[column.dataIndex]) }}
      </slot>
    </template>
  </j-pro-table>
</template>
