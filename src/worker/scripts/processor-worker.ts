import { V1MessageProcessor } from '../../processor/v1-message-processor'
import { parentPort } from 'worker_threads'
import { ProcessorWorkerRequest } from '../worker-types'
import { Logger } from '../../utils/Logger'
import * as Sentry from '@sentry/node'

const processor = new V1MessageProcessor()

parentPort?.on('message', async ({ message, senderId }: ProcessorWorkerRequest) => {
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
