import { computed, ref } from 'vue'
import type { ConditionFilterChangePayload, ConditionFilterField, ConditionFilterTerm } from '@jetlinks-web-core/components/ConditionFilter/types'
import type { useReports } from './useReports'
import { feText } from '../shared/i18n'
import { reportFilterValues } from '../shared/reportSearch'

type Reports = ReturnType<typeof useReports>
export function useReportSearch(reports: Reports, detailed = false) {
  const valid = ref(true), periodValid = ref(true)
  const terms = ref<ConditionFilterTerm[]>(detailed ? [
    { column: 'level', termType: 'eq', value: reports.level.value },
    { column: 'timeRange', termType: 'btw', value: [reports.from.value, reports.to.value] }
  ] : [])
  const periodTerms = ref<ConditionFilterTerm[]>([
    { column: 'period', termType: 'eq', value: reports.period.value },
    { column: 'year', termType: 'eq', value: reports.year.value },
    { column: 'month', termType: 'eq', value: reports.month.value }
  ])
  const fields = computed<ConditionFilterField[]>(() => [
    { title: feText('businessProject'), dataIndex: 'projectId', search: { type: 'select', options: reports.projects.value, termTypeOptions: ['eq'] } },
    ...(detailed ? [
      { title: feText('aggregationLevel'), dataIndex: 'level', search: { type: 'select', termTypeOptions: ['eq'], options: [
        { value: 'master', label: feText('masterMeter') }, { value: 'submeter', label: feText('submeter') },
        { value: 'branch', label: feText('branch') }, { value: 'other', label: feText('other') }
      ] } },
      { title: feText('time'), dataIndex: 'timeRange', search: { type: 'rangePicker', termTypeOptions: ['btw'], componentProps: { showTime: true, format: 'YYYY-MM-DD HH:mm' } } }
    ] : [])
  ])
  const periodFields: ConditionFilterField[] = [
    { title: feText('dailyMonthlyAnnualReports'), dataIndex: 'period', search: { type: 'select', termTypeOptions: ['eq'], options: [
      { value: 'day', label: feText('dailyReport') }, { value: 'month', label: feText('monthlyReport') }, { value: 'year', label: feText('annualReport') }
    ] } },
    { title: feText('yearNumber'), dataIndex: 'year', search: { type: 'number', termTypeOptions: ['eq'], componentProps: { min: 2000, max: 2200, precision: 0 } } },
    { title: feText('monthNumber'), dataIndex: 'month', search: { type: 'number', termTypeOptions: ['eq'], componentProps: { min: 1, max: 12, precision: 0 } } }
  ]
  const change = async ({ filter }: ConditionFilterChangePayload) => {
    const values = reportFilterValues(filter.terms)
    valid.value = !!values
    if (!values) { reports.error.value = feText('reportFilterInvalid'); return }
    reports.projectId.value = values.projectId
    reports.level.value = values.level || 'master'
    reports.from.value = values.from ?? Date.now() - 86400000
    reports.to.value = values.to ?? Date.now()
    reports.periodRows.value = []
    await reports.refresh()
  }
  const changePeriod = ({ filter }: ConditionFilterChangePayload) => {
    const values = reportFilterValues(filter.terms)
    periodValid.value = !!values
    if (!values) { reports.error.value = feText('reportFilterInvalid'); return }
    reports.period.value = values.period || 'day'
    reports.year.value = values.year ?? new Date().getFullYear()
    reports.month.value = values.month ?? new Date().getMonth() + 1
    reports.periodRows.value = []
    void reports.refresh()
  }
  return { terms, fields, change, periodTerms, periodFields, changePeriod, valid, periodValid }
}
