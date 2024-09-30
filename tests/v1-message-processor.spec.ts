/* eslint-disable @typescript-eslint/no-unused-expressions */
import {
  type ChallengeMessage,
  createInitMessage,
  type InitMessage,
  createChallengeMessage,
  createAcceptedMessage,
  type AcceptedMessage,
  type PayloadMessage,
  createPayloadMessage,
  type ResponseMessage,
  createResponseMessage
} from '@acurast/transport-websocket'
import { stub } from 'sinon'

import { Crypto } from '../src/crypto'
import {
  type RespondProcessorAction,
  type ProcessorAction,
  type SendProcessorAction,
  type RegisterProcessorAction
} from '../src/processor/message-processor'
import {
  CHALLENGE_LENGTH,
  DEFAULT_DIFFICULTY,
  V1MessageProcessor,
  V1MessageVerifier
} from '../src/processor/v1-message-processor'

describe('V1MessageProcessor', function () {
  test('processes InitMessage', async function () {
    const sender: Buffer = Buffer.from('ec7b5e7926d2de5fce52fcc220f23ca6', 'hex')
    const initMessage: InitMessage = createInitMessage(sender)

    const processor: V1MessageProcessor = new V1MessageProcessor()
    const actionOrUndefined: ProcessorAction | undefined =
      await processor.processMessage(initMessage)

    expect(actionOrUndefined).toBeTruthy()
    expect(actionOrUndefined!.type).toBe('respond')
    const action: RespondProcessorAction = actionOrUndefined as RespondProcessorAction

    expect(action.message).toBeTruthy()
    expect(action.message.type).toBe('challenge')
    const challengeMessage: ChallengeMessage = action.message as ChallengeMessage

    expect(challengeMessage.recipient).toBe(sender)
    expect(challengeMessage.challenge.length).toBe(CHALLENGE_LENGTH)
  })

  test('processes ChallengeMessage', async function () {
    const recipient: Buffer = Buffer.from('1ef057a3f77d03aa7c067dd113c9410b', 'hex')
    const challengeMessage: ChallengeMessage = createChallengeMessage(
      recipient,
      Buffer.alloc(16),
      DEFAULT_DIFFICULTY
    )

    const processor: V1MessageProcessor = new V1MessageProcessor()
    const actionOrUndefined: ProcessorAction | undefined =
      await processor.processMessage(challengeMessage)

    expect(actionOrUndefined).toBe(undefined)
  })

  test('processes valid ResponseMessage', async function () {
    const sender: Buffer = Buffer.from('1ef057a3f77d03aa7c067dd113c9410b', 'hex')
    const challenge: Buffer = Buffer.from('ee31dab8fa052a68d59feac6a7236f8c', 'hex')
    const publicKey: Buffer = Buffer.from(
      '030c3b833d4abe294dadce48b824eab2b41acd430d284565245d92ed65ae34bd3a',
      'hex'
    )
    const nonce: Buffer = Buffer.from('00000000000000000000000000000000', 'hex')
    const signature: Buffer = Buffer.from(
      '6e194a2c777752b8d92b49aec2272b2c2879ada7e0a8bd4dcd20fe556b9b8a22ee665ffc930517435c751961f7b6e3aa0339828bba59f9d7782d8658e2bf039c',
      'hex'
    )
    const responseMessage: ResponseMessage = createResponseMessage(
      sender,
      challenge,
      publicKey,
      nonce,
      signature
    )

    const crypto: Crypto = new Crypto()
    stub(crypto, 'getRandomValues').returns(challenge)
    const processor: V1MessageProcessor = new V1MessageProcessor(crypto)
    await processor.processMessage(createInitMessage(sender))
    const actionOrUndefined: ProcessorAction | undefined =
      await processor.processMessage(responseMessage)

    expect(actionOrUndefined).toBeTruthy()
    expect(actionOrUndefined!.type).toBe('register')
    const action: RegisterProcessorAction = actionOrUndefined as RegisterProcessorAction

    expect(action.sender).toBe(sender)
  })

  test('processes invalid ResponseMessage', async function () {
    const sender: Buffer = Buffer.from('1ef057a3f77d03aa7c067dd113c9410b', 'hex')
    const challenge: Buffer = Buffer.from('5f77637866fc7fed66eeafb3856dab94', 'hex')
    const publicKey: Buffer = Buffer.from(
      '030c3b833d4abe294dadce48b824eab2b41acd430d284565245d92ed65ae34bd3a',
      'hex'
    )
    const nonce: Buffer = Buffer.from('00000000000000000000000000000000', 'hex')
    const signature: Buffer = Buffer.from(
      '6e194a2c777752b8d92b49aec2272b2c2879ada7e0a8bd4dcd20fe556b9b8a22ee665ffc930517435c751961f7b6e3aa0339828bba59f9d7782d8658e2bf039c',
      'hex'
    )
    const responseMessage: ResponseMessage = createResponseMessage(
      sender,
      challenge,
      publicKey,
      nonce,
      signature
    )

    const crypto: Crypto = new Crypto()
    stub(crypto, 'getRandomValues').returns(challenge)
    const processor: V1MessageProcessor = new V1MessageProcessor(crypto)
    await processor.processMessage(createInitMessage(sender))
    const actionOrUndefined: ProcessorAction | undefined =
      await processor.processMessage(responseMessage)

    expect(actionOrUndefined).toBe(undefined)
  })

  test('processes AcceptedMessage', async function () {
    const recipient: Buffer = Buffer.from('1ef057a3f77d03aa7c067dd113c9410b', 'hex')
    const acceptedMessage: AcceptedMessage = createAcceptedMessage(recipient)

    const processor: V1MessageProcessor = new V1MessageProcessor()
    const actionOrUndefined: ProcessorAction | undefined =
      await processor.processMessage(acceptedMessage)

    expect(actionOrUndefined).toBe(undefined)
  })

  test('processes PayloadMessage', async function () {
    const sender: Buffer = Buffer.from('1ef057a3f77d03aa7c067dd113c9410b', 'hex')
    const recipient: Buffer = Buffer.from('60f4e3122fc04ca961a3bf4d8639860c', 'hex')
    const payload: Buffer = Buffer.from('90cace2932470ec1af20c53ae24abfce', 'hex')
    const payloadMessage: PayloadMessage = createPayloadMessage(sender, recipient, payload)

    const processor: V1MessageProcessor = new V1MessageProcessor()
    const actionOrUndefined: ProcessorAction | undefined =
      await processor.processMessage(payloadMessage)

    expect(actionOrUndefined).toBeTruthy()
    expect(actionOrUndefined!.type).toBe('send')
    const action: SendProcessorAction = actionOrUndefined as SendProcessorAction

    expect(action.message).toEqual(payloadMessage)
  })

  describe('V1MessageVerifier', function () {
    test('verifies valid challenge', async function () {
      const sender: Buffer = Buffer.from('1ef057a3f77d03aa7c067dd113c9410b', 'hex')
      const challenge: Buffer = Buffer.from('ee31dab8fa052a68d59feac6a7236f8c', 'hex')
      const publicKey: Buffer = Buffer.from(
        '030c3b833d4abe294dadce48b824eab2b41acd430d284565245d92ed65ae34bd3a',
        'hex'
      )
      const nonce: Buffer = Buffer.from('00000000000000000000000000000000', 'hex')
      const signature: Buffer = Buffer.from(
        '6e194a2c777752b8d92b49aec2272b2c2879ada7e0a8bd4dcd20fe556b9b8a22ee665ffc930517435c751961f7b6e3aa0339828bba59f9d7782d8658e2bf039c',
        'hex'
      )
      const responseMessage: ResponseMessage = createResponseMessage(
        sender,
        challenge,
        publicKey,
        nonce,
        signature
      )

      const verifier: V1MessageVerifier = new V1MessageVerifier()

      await expect(verifier.verifyChallenge(challenge, responseMessage)).resolves.toBe(undefined)
    })

    test('verifies invalid challenge (challenge mismatch)', async function () {
      const sender: Buffer = Buffer.from('1ef057a3f77d03aa7c067dd113c9410b', 'hex')
      const challenge: Buffer = Buffer.from('5f77637866fc7fed66eeafb3856dab94', 'hex')
      const publicKey: Buffer = Buffer.from(
        '02047561d8c14cf8a8c2bbeaee4072599c3ead0fb1036b5268409b05c6a22c48db',
        'hex'
      )
      const nonce: Buffer = Buffer.from('00000000000000000000000000000000', 'hex')
      const signature: Buffer = Buffer.from(
        '6e194a2c777752b8d92b49aec2272b2c2879ada7e0a8bd4dcd20fe556b9b8a22ee665ffc930517435c751961f7b6e3aa0339828bba59f9d7782d8658e2bf039c',
        'hex'
      )
      const responseMessage: ResponseMessage = createResponseMessage(
        sender,
        challenge,
        publicKey,
        nonce,
        signature
      )

      const verifier: V1MessageVerifier = new V1MessageVerifier()

      await expect(
        verifier.verifyChallenge(
          Buffer.from('ee31dab8fa052a68d59feac6a7236f8c', 'hex'),
          responseMessage
        )
      ).rejects.toBeTruthy()
    })

    test('verifies invalid challenge (invalid public key)', async function () {
      const sender: Buffer = Buffer.from('1ef057a3f77d03aa7c067dd113c9410b', 'hex')
      const challenge: Buffer = Buffer.from('5f77637866fc7fed66eeafb3856dab94', 'hex')
      const publicKey: Buffer = Buffer.from(
        '02047561d8c14cf8a8c2bbeaee4072599c3ead0fb1036b5268409b05c6a22c48db',
        'hex'
      )
      const nonce: Buffer = Buffer.from('00000000000000000000000000000000', 'hex')
      const signature: Buffer = Buffer.from(
        '6e194a2c777752b8d92b49aec2272b2c2879ada7e0a8bd4dcd20fe556b9b8a22ee665ffc930517435c751961f7b6e3aa0339828bba59f9d7782d8658e2bf039c',
        'hex'
      )
      const responseMessage: ResponseMessage = createResponseMessage(
        sender,
        challenge,
        publicKey,
        nonce,
        signature
      )

      const verifier: V1MessageVerifier = new V1MessageVerifier()

      await expect(verifier.verifyChallenge(challenge, responseMessage)).rejects.toBeTruthy()
    })

    test('verifies invalid challenge (invalid signature)', async function () {
      const sender: Buffer = Buffer.from('1ef057a3f77d03aa7c067dd113c9410b', 'hex')
      const challenge: Buffer = Buffer.from('ee31dab8fa052a68d59feac6a7236f8c', 'hex')
      const publicKey: Buffer = Buffer.from(
        '030c3b833d4abe294dadce48b824eab2b41acd430d284565245d92ed65ae34bd3a',
        'hex'
      )
      const nonce: Buffer = Buffer.from('00000000000000000000000000000000', 'hex')
      const signature: Buffer = Buffer.from(
        '411756a9fe03bb680bedd24880846ba4b5840c2c1a05284051af8c538335480b65eb6677919468b6e7a41bf503965c436485e05c48ac5500757c77c807d3e98f',
        'hex'
      )
      const responseMessage: ResponseMessage = createResponseMessage(
        sender,
        challenge,
        publicKey,
        nonce,
        signature
      )

      const verifier: V1MessageVerifier = new V1MessageVerifier()

      await expect(verifier.verifyChallenge(challenge, responseMessage)).rejects.toBeTruthy()
    })
  })
})
