import { PermissionElement } from "../permissions/permission-element"

export type ProxyPermissions = {
  allowList: PermissionElement[]
  denyList: PermissionElement[]
}

export interface ConnectionData {
  permissions?: ProxyPermissions
}
