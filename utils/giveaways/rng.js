const crypto = require('crypto');

/**
 * Deterministic, seed-based pseudo-random integer generator using SHA256.
 * Not cryptographically strong, but allows reproducible winner audits when a seed is published.
 * For actual randomness when seed = null we use crypto.randomInt.
 * @param {string} seed
 * @param {number} counter
 * @param {number} max (exclusive)
 */
function seededRandomInt(seed, counter, max){
  const h = crypto.createHash('sha256').update(seed + ':' + counter).digest();
  // Convert first 6 bytes to integer
  const num = h.readUIntBE(0, 6); // up to ~2^48
  return num % max;
}

/**
 * Given weighted entries, pick up to winnersCount distinct winners fairly.
 * Weight is an integer >=1. Entries flagged as bots are ignored by default.
 * @param {Array} entries Array of { user_id, weight, flags: { is_bot, suspicious_alt }, method }
 * @param {number} winnersCount
 * @param {Object} opts { excludeBots=true, excludeSuspicious=false, seed=null, allowRepeat=false }
 * @returns {Object} { winners: Array<entry>, seedUsed, totalEligible, shortfall }
 */
function pickWinners(entries, winnersCount, opts={}){
  const {
    excludeBots = true,
    excludeSuspicious = false,
    seed = null,
    allowRepeat = false
  } = opts;
  if (!Array.isArray(entries) || !entries.length) {
    return { winners: [], seedUsed: seed || generateSeed(), totalEligible: 0, shortfall: winnersCount };
  }
  const seedUsed = seed || generateSeed();
  // Filter eligible
  let eligible = entries.filter(e => {
    if (!e || typeof e !== 'object') return false;
    if (excludeBots && e.flags && e.flags.is_bot) return false;
    if (excludeSuspicious && e.flags && e.flags.suspicious_alt) return false;
    if (!e.weight || e.weight <= 0) return false;
    return true;
  });
  if (!eligible.length) {
    return { winners: [], seedUsed, totalEligible: 0, shortfall: winnersCount };
  }
  // Build cumulative weight array for weighted sampling without expansion.
  const weights = eligible.map(e => Math.max(1, e.weight|0));
  const totalWeight = weights.reduce((a,b)=>a+b,0);
  const cumulative = []; let running = 0;
  for (let w of weights){ running += w; cumulative.push(running); }

  const winners = []; const pickedUserIds = new Set();
  const maxPicks = allowRepeat ? winnersCount : Math.min(winnersCount, eligible.length);
  let counter = 0;
  while (winners.length < maxPicks){
    const r = seed ? seededRandomInt(seedUsed, counter++, totalWeight) : crypto.randomInt(0, totalWeight);
    // Binary search cumulative
    let lo=0, hi=cumulative.length-1, idx=-1;
    while (lo<=hi){
      const mid = (lo+hi)>>1;
      if (r < cumulative[mid]){ idx=mid; hi=mid-1; } else { lo=mid+1; }
    }
    if (idx < 0) continue; // extremely unlikely
    const candidate = eligible[idx];
    if (!allowRepeat){
      if (pickedUserIds.has(candidate.user_id)) continue; // retry
      pickedUserIds.add(candidate.user_id);
    }
    winners.push(candidate);
  }
  const shortfall = winnersCount - winners.length;
  return { winners, seedUsed, totalEligible: eligible.length, shortfall: shortfall > 0 ? shortfall : 0 };
}

function generateSeed(){
  return crypto.randomBytes(16).toString('hex');
}

module.exports = { pickWinners, generateSeed };
