import { V1MessageProcessor } from '../../processor/v1-message-processor'
import { parentPort } from 'worker_threads'
import { ProcessorWorkerRequest } from '../worker-types'
import { Logger } from '../../utils/Logger'
import * as Sentry from '@sentry/node'
import { MessageProcessor } from '../../processor/message-processor'

const processors: Record<number, MessageProcessor> = {
  1: new V1MessageProcessor()
}

parentPort?.on('message', async ({ message, senderId }: ProcessorWorkerRequest) => {
  const processor: MessageProcessor | undefined = processors[message.version]
  
  if (processor === undefined) {
    Logger.log('Message version', message.version, 'not supported')
    return
  }

  processor
    .processMessage(message)
    .then((action) => parentPort?.postMessage({ action, senderId }))
    .catch((err) => {
      Logger.error(err.message)
      Sentry.captureException(err)
      parentPort?.postMessage({
        error: true,
        message: err.message,
        data: senderId
      })
    })
})
