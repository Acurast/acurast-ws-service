import { InitMessage } from '@acurast/transport-websocket'
import { ConnectionData } from './connection-data'
import { hexFrom } from '../utils/bytes'
import { PermissionElement } from '../permissions/permission-element'

export class ConnectionDataInitializer {
  private static toHexList(list: Uint8Array[]) {
    return list.map(
      (el) =>
        ({
          address: hexFrom(el)
        }) as PermissionElement
    )
  }

  static initialize(message?: InitMessage): ConnectionData {
    if (!message) {
      return {}
    }
    return {
      permissions: message.permissions
        ? {
            allowList: this.toHexList(message.permissions.allowList),
            denyList: this.toHexList(message.permissions.denyList)
          }
        : undefined
    }
  }
}
