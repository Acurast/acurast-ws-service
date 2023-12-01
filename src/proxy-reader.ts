import config from './acurast.proxy.config.json'

export function proxyConfigReader<T>(path: string, fallbackValue: T): T {
  let currentObj: any = config
  const props = path.split('.')

  for (const property of props) {
    if (currentObj && property in currentObj) {
      currentObj = currentObj[property]
    } else {
      return fallbackValue
    }
  }

  return currentObj
}
