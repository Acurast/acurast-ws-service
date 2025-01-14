import { parentPort } from 'worker_threads'
import { ListenerWorkerAction, ListenerWorkerRequest } from '../worker-types'
import { Listener } from '../../peer/listener'
import { Logger } from '../../utils/Logger'
import * as Sentry from '@sentry/node'

const listener = new Listener()
listener.subscribe((data) => parentPort?.postMessage(data))

const handleAddListener = (topic: string) => {
  listener.listen(topic)
}

const handleRemoveListener = (topic: string) => {
  listener.removeListener(topic)
}

const handlePublish = (topic: string, message?: Uint8Array) => {
  if (!message) {
    Logger.error('No message to send')
    return
  }

  listener.send(topic, message).catch((err: any) => {
    Logger.error('recipient:', topic, 'error:', err.message)
    parentPort?.postMessage({
      error: true,
      message: err.message
    })
    Sentry.captureException(err)
  })
}

parentPort?.on('message', async ({ action, topic, message }: ListenerWorkerRequest) => {
  switch (action) {
    case ListenerWorkerAction.SUBSCRIBE:
      handleAddListener(topic)
      break
    case ListenerWorkerAction.UNSUBSCRIBE:
      handleRemoveListener(topic)
      break
    case ListenerWorkerAction.PUBLISH:
      handlePublish(topic, message)
      break
    default:
      Logger.error('Invalid action type')
  }
})
