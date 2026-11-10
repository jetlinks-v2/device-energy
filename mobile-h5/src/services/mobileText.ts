import { feLocale } from '../../../shared/i18n'
/** Mobile-only copy stays separate from the PC menu translations. */
export const m = (zh: string, en: string) => feLocale() === 'en' ? en : zh
