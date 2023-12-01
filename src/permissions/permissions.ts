import { PermissionElement } from './permission-element'

export default class Permissions {
  private static isNoneSet(allowList: PermissionElement[], denyList: PermissionElement[]) {
    return !allowList.length && !denyList.length
  }

  private static isInDenylist(denyList: PermissionElement[], address: string) {
    return denyList.some((el) => el.address === address)
  }

  private static isInAllowlist(allowList: PermissionElement[], address: string) {
    return allowList.some((el) => el.address === address)
  }

  static isAllowed(address: string, allowList: PermissionElement[], denyList: PermissionElement[]): boolean {
    return this.isNoneSet(allowList, denyList) || (!this.isInDenylist(denyList, address) && (allowList.length == 0 || this.isInAllowlist(allowList, address)))
  }
}
