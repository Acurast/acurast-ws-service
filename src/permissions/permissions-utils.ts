import { proxyConfigReader } from '../proxy-reader'
import { PermissionElement } from './permission-element'

export class PermissionsUtils {
  static initList(path: string) {
    return (proxyConfigReader(path, []) as PermissionElement[])
  }
}
