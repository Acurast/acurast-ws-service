import {
  type InitMessage,
  log,
  type Message,
  type PayloadMessage,
  type ResponseMessage,
  createAcceptedMessage,
  createChallengeMessage,
  verifyDifficulty
} from '@acurast/transport-websocket'

import { hexFrom } from '../utils/bytes'
import { Crypto } from '../crypto'

import { type ProcessorAction, type MessageProcessor } from './message-processor'

export const DEFAULT_DIFFICULTY: Uint8Array = new Uint8Array(16).map(() => 255)
export const CHALLENGE_LENGTH: number = 16

export class V1MessageProcessor implements MessageProcessor {
  private readonly challenges: Map<string, Uint8Array> = new Map()

  public constructor(
    private readonly crypto: Crypto = new Crypto(),
    private readonly verifier: V1MessageVerifier = new V1MessageVerifier(crypto)
  ) {}

  public async processMessage(message: Message): Promise<ProcessorAction | undefined> {
    if (message.version !== 1) {
      return undefined
    }

    switch (message.type) {
      case 'init':
        return await this.onInit(message)
      case 'response':
        return await this.onResponse(message)
      case 'payload':
        return await this.onPayload(message)
      default:
        return undefined
    }
  }

  public async onClosed(sender: Uint8Array): Promise<void> {
    this.challenges.delete(hexFrom(sender))
  }

  private async onInit(message: InitMessage): Promise<ProcessorAction | undefined> {
    const challenge: Uint8Array = this.crypto.getRandomValues(CHALLENGE_LENGTH)

    const sender: string = hexFrom(message.sender)
    this.challenges.set(sender, challenge)

    return {
      type: 'respond',
      message: createChallengeMessage(message.sender, challenge, DEFAULT_DIFFICULTY)
    }
  }

  private async onResponse(message: ResponseMessage): Promise<ProcessorAction | undefined> {
    const sender: string = hexFrom(message.sender)
    const challenge: Uint8Array | undefined = this.challenges.get(sender)
    if (challenge === undefined) {
      this.log('Challenge not found for', sender)
      return undefined
    }

    this.challenges.delete(sender)

    try {
      await this.verifier.verifyChallenge(challenge, message)

      this.log('Challenge verification for', sender, 'passed')
      return {
        type: 'register',
        sender: message.sender,
        message: createAcceptedMessage(message.sender)
      }
    } catch (error: unknown) {
      this.log(
        'Challenge verification for',
        sender,
        'failed:',
        error instanceof Error ? error.message : error
      )
      return undefined
    }
  }

  private async onPayload(message: PayloadMessage): Promise<ProcessorAction> {
    return { type: 'send', message }
  }

  private log(...data: any[]): void {
    log('[V1-MESSAGE-PROCESSOR]', ...data)
  }
}

export class V1MessageVerifier {
  public constructor(private readonly crypto: Crypto = new Crypto()) {}

  public async verifyChallenge(challenge: Uint8Array, message: ResponseMessage): Promise<void> {
    if (!Buffer.from(challenge).equals(message.challenge)) {
      throw new Error('Challenge mismatch')
    }

    const pkh: Buffer = this.crypto.sha256(message.publicKey)
    if (!Buffer.from(pkh.subarray(0, 16)).equals(message.sender)) {
      throw new Error('Invalid public key')
    }

    const payload: Buffer = Buffer.concat([challenge, message.publicKey, message.nonce])
    const payloadHash: Buffer = this.crypto.sha256(payload)
    const difficultyVerified: boolean = this.verifyDifficulty(payloadHash)
    if (!difficultyVerified) {
      throw new Error('Difficulty too low')
    }

    const verified: boolean = this.crypto.verifyP256(
      payloadHash,
      message.signature,
      message.publicKey
    )
    if (!verified) {
      throw new Error('Invalid signature')
    }
  }

  private verifyDifficulty(data: Uint8Array, difficulty: Uint8Array = DEFAULT_DIFFICULTY): boolean {
    return verifyDifficulty(data, difficulty)
  }

  // eslint-disable-next-line @typescript-eslint/ban-ts-comment
  // @ts-expect-error
  private validateProofOfWork(
    crypto: Crypto,
    payload: Uint8Array,
    nonce: Uint8Array,
    difficulty: Uint8Array = DEFAULT_DIFFICULTY
  ): boolean {
    const difficultyHash = crypto.sha256(Buffer.concat([payload, nonce]))
    return verifyDifficulty(difficultyHash, difficulty)
  }
}
