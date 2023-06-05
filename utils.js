const { subtle } = globalThis.crypto
const HASH_ALGORITHM = "SHA-256"

exports.EMPTY_ADDRESS = new Uint8Array(16)
exports.EMPTY_PAYLOAD = new Uint8Array(0)
exports.DIFFICULTY = new Uint8Array(32).map(_=>255)

exports.toHexString = (byteArray) => {
    const chars = new Uint8Array(byteArray.length * 2)
    const alpha = 'a'.charCodeAt(0) - 10;
    const digit = '0'.charCodeAt(0);

    let p = 0;
    for (let i = 0; i < byteArray.length; i++) {
        let nibble = byteArray[i] >>> 4;
        chars[p++] = nibble > 9 ? nibble + alpha : nibble + digit;
        nibble = byteArray[i] & 0xF;
        chars[p++] = nibble > 9 ? nibble + alpha : nibble + digit;
    }

    return String.fromCharCode.apply(null, chars);
}

exports.concatUint8Arrays = (payloads) => {
    const payload = new Uint8Array(payloads.reduce((aggregator, runner) => { return aggregator + runner.length }, 0))
    payloads.reduce((aggregator, runner) => {
        payload.set(runner, aggregator)
        return runner.length + aggregator
    }, 0)
    return payload
}

exports.arrayGreaterThan = (a, b) => {
    if (a.length < b.length) {
        return false
    } else {
        for (let i = 0; i < a.length; i += 1) {
            if ((a[i] < b[i])) return false
        }
        return true
    }
}

exports.arrayEquals = (a, b) => {
    if (a.length !== b.length) {
        return false
    } else {
        for (let i = a.length; -1 < i; i -= 1) {
            if ((a[i] !== b[i])) return false
        }
        return true
    }
}

exports.proofOfWork = async (payload, difficulty = exports.DIFFICULTY) => {
    while (true) {
        const nonce = new Uint8Array(16)
        crypto.getRandomValues(nonce)

        const difficultyHash = new Uint8Array(await subtle.digest(HASH_ALGORITHM, exports.concatUint8Arrays([payload, nonce])))
        
        if (exports.arrayGreaterThan(difficulty, difficultyHash)) {
            return nonce
        }
    }
}

exports.validateProofOfWork = async (payload, nonce, difficulty = exports.DIFFICULTY) => {
    const difficultyHash = new Uint8Array(await subtle.digest(HASH_ALGORITHM, exports.concatUint8Arrays([payload, nonce])))
    return exports.arrayGreaterThan(difficulty, difficultyHash)
}