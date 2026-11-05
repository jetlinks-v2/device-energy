import './styles/facility.css'
import {getModuleRoutesMap} from '@jetlinks-web/utils'
const views=import.meta.glob('./views/**/index.vue')
/** 公共档案页面由 property-base-ui 注册，本模块只注册设施能源业务页面。 */
export default {getAsyncRoutesMap:()=>getModuleRoutesMap(views)}
