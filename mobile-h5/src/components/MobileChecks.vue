<script setup lang="ts">
import { computed } from 'vue'
import { CameraOutlined, CheckCircleFilled, CheckOutlined, CloseOutlined, CheckSquareOutlined } from '@ant-design/icons-vue'
import type { CheckItem, CheckResult } from '../../../shared/types'
import { incompleteCheck } from '../services/checks'
import { m } from '../services/mobileText'
import PhotoPreview from './PhotoPreview.vue'
const props = defineProps<{ items: CheckItem[]; results: CheckResult[]; readonly?: boolean; busy?: boolean; preview?: boolean }>()
const emit = defineEmits<{ change: [CheckResult[]]; photo: [string, File] }>()
const result = (id: string) => props.results.find(r => r.itemId === id)
const complete = computed(() => props.items.filter(i => !!result(i.id)?.value?.trim() && !incompleteCheck([i], props.results)).length)
function update(id: string, values: Partial<CheckResult>) {
  const rows = props.results.map(r => ({ ...r, attachments: [...r.attachments] }))
  let row = rows.find(r => r.itemId === id)
  if (!row) { row = { itemId: id, value: '', abnormal: false, attachments: [] }; rows.push(row) }
  Object.assign(row, values); emit('change', rows)
}
function capture(id: string, event: Event) {
  const input = event.target as HTMLInputElement
  if (input.files?.[0]) emit('photo', id, input.files[0])
  input.value = ''
}
function options(item: CheckItem) { return item.kind === 'boolean' ? ['true', 'false'] : item.options || [] }
function numeric(item: CheckItem, value: string) {
  const number = Number(value)
  update(item.id, { value, abnormal: !!value.trim() && ((item.minimum != null && number < item.minimum) || (item.maximum != null && number > item.maximum)) })
}
function label(value: string) { return ['true', '符合'].includes(value) ? m('符合', 'Compliant') : ['false', '不符合'].includes(value) ? m('不符合', 'Noncompliant') : value }
</script>
<template>
  <section v-if="preview" class="check-preview">
    <h2><CheckSquareOutlined />{{ m('检查要求', 'Check requirements') }}</h2>
    <div v-for="item in items" :key="item.id" class="requirement-row">
      <p class="multiline">{{ item.name }}</p><span v-if="item.photoRequired" class="photo-requirement"><CameraOutlined />{{ m('需拍照', 'Photo required') }}</span>
    </div>
    <p v-if="!items.length" class="muted">{{ m('此任务暂无检查要求', 'No check requirements') }}</p>
  </section>
  <section v-else class="checks">
    <div class="section-heading"><h2>{{ m('检查要求', 'Check requirements') }}</h2><span>{{ complete }} / {{ items.length }}</span></div>
    <article v-for="(item, index) in items" :key="item.id" class="check-item" :id="'check-' + item.id">
      <div class="check-heading"><span class="check-index">{{ index + 1 }}</span><h3>{{ item.name }}<span v-if="item.required" class="required"> *</span></h3><CheckCircleFilled v-if="result(item.id)?.value?.trim() && !incompleteCheck([item], results)" class="complete-icon" /></div>
      <template v-if="readonly"><p class="check-answer">{{ label(result(item.id)?.value || '—') }}<span v-if="result(item.id)?.abnormal" class="status" data-state="rectify">{{ m('异常', 'Abnormal') }}</span></p></template>
      <template v-else>
        <div v-if="['boolean', 'choice'].includes(item.kind)" class="check-options"><button v-for="value in options(item)" :key="value" type="button" :disabled="busy" :class="{ selected: result(item.id)?.value === value, negative: ['false', '不符合'].includes(value) }" @click="update(item.id, { value, abnormal: ['false', '不符合'].includes(value) })"><CloseOutlined v-if="['false', '不符合'].includes(value)" /><CheckOutlined v-else />{{ label(value) }}</button></div>
        <a-input v-else :value="result(item.id)?.value" :disabled="busy" :type="item.kind === 'number' ? 'number' : 'text'" :placeholder="m('填写检查结果', 'Enter result')" @update:value="item.kind === 'number' ? numeric(item, $event) : update(item.id, { value: $event })" />
        <a-checkbox v-if="!['boolean', 'choice'].includes(item.kind)" :checked="result(item.id)?.abnormal" :disabled="busy" @update:checked="update(item.id, { abnormal: $event })">{{ m('发现异常', 'Abnormal result') }}</a-checkbox>
      </template>
      <div class="photos"><PhotoPreview v-for="file in result(item.id)?.attachments || []" :key="file" :id="file" :removable="!readonly && !busy" @remove="update(item.id, { attachments: result(item.id)!.attachments.filter(id => id !== file) })" />
        <label v-if="!readonly" class="photo-add" :class="{ disabled: busy }"><CameraOutlined /><span>{{ item.photoRequired ? m('拍照 *', 'Photo *') : m('拍照', 'Photo') }}</span><input type="file" accept="image/*" :disabled="busy" :aria-label="m('添加现场照片', 'Add site photo')" @change="capture(item.id, $event)" /></label>
      </div>
      <p v-if="readonly && result(item.id)?.remark" class="check-remark">{{ result(item.id)?.remark }}</p>
      <a-textarea v-else-if="!readonly" :value="result(item.id)?.remark" :disabled="busy" :auto-size="{ minRows: 1, maxRows: 4 }" :placeholder="m('备注（选填）', 'Note (optional)')" @update:value="update(item.id, { remark: $event })" />
    </article>
    <a-empty v-if="!items.length" :description="m('此任务暂无检查要求', 'No check requirements')" />
  </section>
</template>
<style scoped>
.check-preview { padding: 18px 16px; margin-bottom: 14px; border-radius: 14px; background: var(--surface); box-shadow: 0 3px 14px rgb(32 52 72 / 4%); }
.check-preview h2 { display: flex; align-items: center; gap: 8px; font-size: 17px; margin-bottom: 16px; }
.check-preview h2 .anticon { color: var(--sky-strong); }
.requirement-row + .requirement-row { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--line); }
.requirement-row p { font-size: 15px; line-height: 1.75; }
.photo-requirement { display: inline-flex; align-items: center; gap: 5px; margin-top: 8px; color: var(--muted); font-size: 13px; }
</style>
