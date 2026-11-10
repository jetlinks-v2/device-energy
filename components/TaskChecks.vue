<script setup lang="ts">
import type { CheckItem, CheckResult } from '../shared/types'
import { feText } from '../shared/i18n'
import { useAttachmentImages } from '../hooks/useAttachmentImages'
const props = defineProps<{ items: CheckItem[]; results: CheckResult[] }>()
const images = useAttachmentImages(() => props.results.flatMap(result => result.attachments || []))
const resultValue = (result: CheckResult) => result.value === 'true' ? feText('yes')
  : result.value === 'false' ? feText('no') : result.value
</script>
<template>
  <a-list :data-source="items" :locale="{ emptyText: feText('noInspectionItems') }" class="task-checks">
    <template #renderItem="{ item, index }">
      <a-list-item>
        <div class="task-checks__item">
          <div class="task-checks__title"><span>{{ index + 1 }}.</span><span>{{ item.name }}</span>
            <a-tag v-if="item.photoRequired">{{ feText('requiredPhotos') }}</a-tag>
          </div>
          <template v-for="result in results.filter(row => row.itemId === item.id)" :key="result.itemId">
            <div class="task-checks__result">
              <span>{{ feText('executionResult') }}：{{ resultValue(result) }}</span>
              <a-tag v-if="result.abnormal" color="red">{{ feText('abnormal') }}</a-tag>
            </div>
            <p v-if="result.remark" class="task-checks__remark">{{ result.remark }}</p>
            <div v-if="result.attachments?.length" class="task-checks__photos">
              <a-image-preview-group>
                <template v-for="id in result.attachments" :key="id">
                  <a-image v-if="images[id]?.url" :src="images[id].url" :width="88" :height="88" :alt="item.name" />
                  <a-alert v-else-if="images[id]?.error" :message="images[id].error" type="error" show-icon />
                  <a-spin v-else class="task-checks__photo-loading" />
                </template>
              </a-image-preview-group>
            </div>
          </template>
          <span v-if="!results.some(row => row.itemId === item.id)" class="task-checks__pending">{{ feText('notChecked') }}</span>
        </div>
      </a-list-item>
    </template>
  </a-list>
</template>
<style scoped>
.task-checks__item { width: 100%; min-width: 0; }
.task-checks__title { display: flex; align-items: flex-start; gap: 8px; white-space: pre-wrap; overflow-wrap: anywhere; font-weight: 500; }
.task-checks__title > span:nth-child(2) { flex: 1; }
.task-checks__result { display: flex; align-items: center; gap: 8px; margin-top: 10px; overflow-wrap: anywhere; }
.task-checks__remark { margin: 8px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.task-checks__pending { display: block; margin-top: 8px; color: var(--ant-color-text-secondary, #888); }
.task-checks__photos { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 10px; }
.task-checks__photos :deep(.ant-image-img) { border-radius: 6px; object-fit: cover; }
.task-checks__photos :deep(.ant-image-mask) { border-radius: 6px; }
.task-checks__photo-loading { display: grid; place-items: center; width: 88px; height: 88px; }
</style>
