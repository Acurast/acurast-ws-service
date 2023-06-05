let maxLockTime = 10*60*1000 

let entryTimestamp = 1685168632
let userAEntryTimestamp = entryTimestamp + 5*60*1000
let userBEntryTimestamp = userAEntryTimestamp + maxLockTime

/

let distFactor = 1*10**12

let userAStake = 100 
let userBStake = 100

let weigthedAStake = userAEntryTimestamp*userAStake
let weightedBStake = userBEntryTimestamp*userBStake

let totalStake = weigthedAStake+weightedBStake

console.log(`user A receives ${weigthedAStake/totalStake}`)
console.log(`user B receives ${weightedBStake/totalStake}`)

