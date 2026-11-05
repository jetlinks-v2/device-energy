export interface Session {
  token: string
  tenantDomain: string
  applicationId: string
}
export interface RuntimeConfig {
  applicationId: string
  tenantDomain: string
  title: string
  allowedHostOrigins: string[]
  apiBase: string
  propertyTelephone?: string
}
export type { Authorization } from '../../shared/types'
