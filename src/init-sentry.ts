import * as Sentry from '@sentry/node'
import { type Express } from 'express'
import { proxyConfigReader } from './proxy-reader'

export function initSentry(app: Express) {
  Sentry.init({
    dsn: 'https://21ab0d8814ef458697d2f8634e30116e@sentry.papers.tech/210',
    integrations: [
      // enable HTTP calls tracing
      new Sentry.Integrations.Http({ tracing: true }),
      // enable Express.js middleware tracing
      new Sentry.Integrations.Express({ app }),
      // Automatically instrument Node.js libraries and frameworks
      ...Sentry.autoDiscoverNodePerformanceMonitoringIntegrations()
    ],
    environment: proxyConfigReader('instanceName', undefined),
    // Set tracesSampleRate to 1.0 to capture 100%
    // of transactions for performance monitoring.
    // We recommend adjusting this value in production
    tracesSampleRate: 1.0
  })

  // RequestHandler creates a separate execution context, so that all
  // transactions/spans/breadcrumbs are isolated across requests
  app.use(Sentry.Handlers.requestHandler())
  // TracingHandler creates a trace for every incoming request
  app.use(Sentry.Handlers.tracingHandler())

  // The error handler must be before any other error middleware and after all controllers
  app.use(Sentry.Handlers.errorHandler())

  // Optional fallthrough error handler
  app.use(function onError(_err: any, _req: any, res: any, _next: any) {
    // The error id is attached to `res.sentry` to be returned
    // and optionally displayed to the user for support.
    res.statusCode = 500
    res.end(res.sentry + '\n')
  })
}
