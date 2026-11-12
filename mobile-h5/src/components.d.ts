import MobileNotice from './components/MobileNotice.vue'
import MobileSheet from './components/MobileSheet.vue'
import MobileSelect from './components/MobileSelect.vue'
declare module 'vue' {
  export interface GlobalComponents { MobileNotice: typeof MobileNotice; MobileSheet: typeof MobileSheet; MobileSelect: typeof MobileSelect }
}
export {}
