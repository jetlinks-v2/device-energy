<template>
  <div class="patrol-rule-editor">
    <div v-for="(rule, index) in draft.weekRules" :key="index" class="rule-card">
      <div class="rule-head">
        <span class="rule-badge">{{ t('FacilityEnergy.ruleEditor.ruleNumber', { index: index + 1 }) }}</span>
        <span>{{ t('FacilityEnergy.ruleEditor.weekdays') }}</span>
        <a-button v-for="day in 7" :key="day" class="day-chip" :class="{ selected: rule.days.includes(day) }" :aria-pressed="rule.days.includes(day)" @click="toggleDay(rule, day)">{{ t(`FacilityEnergy.week${day}`) }}</a-button>
        <span class="muted">{{ t('FacilityEnergy.ruleEditor.quick') }}</span>
        <a-button v-for="quick in quickDays" :key="quick.key" type="link" size="small" @click="setDays(rule, quick.days)">{{ t(`FacilityEnergy.ruleEditor.${quick.key}`) }}</a-button>
        <span class="muted">{{ t('FacilityEnergy.ruleEditor.selected', { count: rule.days.length }) }}</span>
        <a-button class="delete-rule" danger type="link" @click="draft.weekRules.splice(index, 1)">{{ t('FacilityEnergy.ruleEditor.removeRule') }}</a-button>
      </div>
      <CycleWindowEditor v-model="rule.periods" />
    </div>
    <a-button type="dashed" block :disabled="draft.weekRules.length >= 7" @click="draft.weekRules.push({ days: [], periods: [defaultPeriod()] })">+ {{ t('FacilityEnergy.ruleEditor.addRule') }}</a-button>
    <div class="advanced-head">
      <span>{{ t('FacilityEnergy.ruleEditor.advanced') }}</span>
      <a-button type="link" :aria-expanded="advancedOpen" @click="advancedOpen = !advancedOpen">{{ t(advancedOpen ? 'FacilityEnergy.ruleEditor.collapse' : 'FacilityEnergy.ruleEditor.expand') }}</a-button>
    </div>
    <div v-if="advancedOpen">
      <div v-for="(rule, index) in draft.dateRules" :key="index" class="rule-card date-rule">
        <div class="rule-head date-head">
          <span class="rule-badge date-badge">{{ t('FacilityEnergy.ruleEditor.date') }}</span>
          <a-date-picker v-model:value="rule.date" value-format="YYYY-MM-DD" :aria-label="t('FacilityEnergy.ruleEditor.date')" />
          <span class="muted">{{ t('FacilityEnergy.ruleEditor.dateHint') }}</span>
          <a-button class="delete-rule" danger type="link" @click="draft.dateRules.splice(index, 1)">{{ t('FacilityEnergy.ruleEditor.removeDate') }}</a-button>
        </div>
        <a-alert v-if="rule.legacyRest && !rule.periods.length" type="info" :message="t('FacilityEnergy.ruleSummary.rest')" />
        <a-checkbox :checked="!rule.periods.length" @update:checked="rule.periods = $event ? [] : [defaultPeriod()]; rule.legacyRest = $event">{{ t('FacilityEnergy.ruleSummary.rest') }}</a-checkbox>
        <CycleWindowEditor v-if="rule.periods.length" :model-value="rule.periods" @update:model-value="rule.periods = $event; rule.legacyRest = false" />
      </div>
      <a-button type="dashed" block :disabled="draft.dateRules.length >= 366" @click="draft.dateRules.push({ date: '', periods: [defaultPeriod()] })">+ {{ t('FacilityEnergy.ruleEditor.addDate') }}</a-button>
    </div>
    <div class="summary-box">
      <strong>{{ t('FacilityEnergy.ruleEditor.preview') }}</strong>
      <div v-for="(rule, index) in draft.weekRules" :key="`week-${index}`" class="summary-line">
        {{ rule.days.length ? [...rule.days].sort((a,b) => a-b).map(day => t(`FacilityEnergy.week${day}`)).join('、') : t('FacilityEnergy.ruleEditor.noDays') }}：{{ periodsText(rule.periods) }}
      </div>
      <div v-for="(rule, index) in draft.dateRules" :key="`date-${index}`" class="summary-line">{{ rule.date || t('FacilityEnergy.ruleEditor.noDate') }}：{{ periodsText(rule.periods) }}</div>
    </div>
  </div>
</template>
<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Alert as AAlert, DatePicker as ADatePicker, Button as AButton } from 'ant-design-vue'
import CycleWindowEditor from './CycleWindowEditor.vue'
import type { CycleRule } from '../shared/cycle/types'
import { ruleDraft, defaultPeriod, ruleDraftIssue, serializeRule, periodCount, type WeekRuleDraft, type PeriodDraft } from '../shared/cycle/editor'
const props = defineProps<{ modelValue: CycleRule }>()
const emit = defineEmits<{ 'update:modelValue': [rule: CycleRule] }>()
const { t } = useI18n()
// 草稿独立于服务端map；空星期、重复日期等未完成输入须留在表单供校验，不能覆盖合并后丢失。
const draft = reactive(ruleDraft(props.modelValue))
const advancedOpen = ref(draft.dateRules.length > 0)
const quickDays = [
  { key: 'workdays', days: [1,2,3,4,5] }, { key: 'weekend', days: [6,7] },
  { key: 'allWeek', days: [1,2,3,4,5,6,7] }, { key: 'clear', days: [] },
]
function setDays(rule: WeekRuleDraft, days: number[]) { rule.days = [...days] }
function toggleDay(rule: WeekRuleDraft, day: number) {
  rule.days = rule.days.includes(day) ? rule.days.filter(value => value !== day) : [...rule.days, day]
}
function periodsText(periods: PeriodDraft[]) {
  if (!periods.length) return t('FacilityEnergy.ruleSummary.empty')
  return periods.map(p => t('FacilityEnergy.ruleEditor.periodPreview', {
    start: p.start, end: p.end, frequency: p.frequency ?? '', unit: t(`FacilityEnergy.ruleEditor.unit${p.frequencyUnit}`),
    times: p.times ?? '', interval: p.interval ?? '', intervalUnit: t(`FacilityEnergy.ruleEditor.unit${p.intervalUnit}`),
    count: Number.isFinite(periodCount(p)) ? periodCount(p) : 0,
  })).join('；')
}
function validate(): CycleRule {
  const error = ruleDraftIssue(draft)
  if (error) throw new Error(t(error.key, error.values || {}))
  const value = serializeRule(draft)
  emit('update:modelValue', value)
  return value
}
defineExpose({ validate })
</script>
<style scoped>
.patrol-rule-editor { width: 100%; }
.rule-card { border: 1px solid var(--ant-color-border-secondary, #d8e7f8); border-top: 3px solid var(--ant-color-primary, #1677ff); border-radius: 4px; padding: 14px; margin-bottom: 16px; background: var(--ant-color-fill-quaternary, #fbfdff); }
.rule-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.rule-badge { padding: 7px 12px; border-radius: 14px; color: #fff; background: var(--ant-color-primary, #1677ff); }
.date-badge { background: var(--ant-color-warning, #d99a28); }
.day-chip { border-radius: 14px; height: 40px; }
.day-chip.selected { color: var(--ant-color-primary, #1677ff); border-color: var(--ant-color-primary, #1677ff); background: var(--ant-color-primary-bg, #eef7ff); }
.muted { color: var(--ant-color-text-tertiary, #8a9aaa); font-size: 12px; }
.rule-tip { margin: 12px 0 16px; }
.delete-rule { margin-inline-start: auto; }
.advanced-head { display: flex; align-items: center; gap: 8px; margin: 20px 0 12px; }
.date-head { margin-bottom: 12px; }
.summary-box { margin-top: 18px; padding: 12px 14px; border: 1px solid var(--ant-color-border-secondary, #d8e7f8); border-radius: 6px; background: var(--ant-color-primary-bg, #f1f6fb); line-height: 1.8; }
.summary-line { overflow-wrap: anywhere; }
</style>
