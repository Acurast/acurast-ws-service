export type Observer<T> = (data: T) => void

export interface Subscription {
  unsubscribe: () => void
}

export abstract class Observable<T> {
  private observers: Observer<T>[] = []

  subscribe(observer: Observer<T>): Subscription {
    this.observers.push(observer)

    const unsubscribe = () => {
      this.unsubscribe(observer)
    }

    return { unsubscribe }
  }

  protected unsubscribe(observer: Observer<T>): void {
    this.observers = this.observers.filter((subscriber) => subscriber !== observer)
  }

  protected next(data: T): void {
    this.observers.forEach((observer) => observer(data))
  }
}
