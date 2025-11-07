const assert = require('assert');
const { pickWinners, generateSeed } = require('../../utils/giveaways/rng');

function makeEntry(id, weight=1, flags={}){ return { user_id: String(id), weight, flags }; }

describe('giveaways RNG pickWinners', () => {
  it('returns empty when no entries', () => {
    const r = pickWinners([], 3);
    assert.strictEqual(r.winners.length, 0);
    assert.strictEqual(r.shortfall, 3);
  });

  it('simple uniform selection size <= entries (deterministic seed)', () => {
    const entries = [1,2,3,4,5].map(id => makeEntry(id));
    const seed = generateSeed();
    const r = pickWinners(entries, 3, { seed });
    assert.strictEqual(r.winners.length, 3);
    // determinism: re-run same seed
    const r2 = pickWinners(entries, 3, { seed });
    assert.deepStrictEqual(r.winners.map(w=>w.user_id), r2.winners.map(w=>w.user_id));
  });

  it('never picks more than eligible without repeat', () => {
    const entries = [1,2].map(id => makeEntry(id));
    const r = pickWinners(entries, 5, { seed: generateSeed() });
    assert.strictEqual(r.winners.length, 2);
    assert.strictEqual(r.shortfall, 3);
  });

  it('excludes bots by default', () => {
    const entries = [makeEntry('a',1,{ is_bot:true }), makeEntry('b',1,{}), makeEntry('c',1,{})];
    const r = pickWinners(entries, 2, { seed: generateSeed() });
    const ids = r.winners.map(w=>w.user_id);
    assert(!ids.includes('a'));
    assert.strictEqual(r.totalEligible, 2);
  });

  it('weight bias: higher weight appears more often over many trials', () => {
    const entries = [makeEntry('low',1,{}), makeEntry('high',5,{})];
    let highWins = 0; const TRIALS = 400;
    const seed = generateSeed();
    // Use allowRepeat with different generated seeds to approximate fairness
    for (let i=0;i<TRIALS;i++){
      const s = seed + ':' + i; // vary seed deterministically
      const r = pickWinners(entries, 1, { seed: s });
      if (r.winners[0].user_id === 'high') highWins++;
    }
    // Expect high weight picked significantly more often ( > 60% threshold )
    assert(highWins > TRIALS * 0.6, `High weight picked only ${highWins}/${TRIALS}`);
  });

  it('exclude suspicious when flag set', () => {
    const entries = [makeEntry('good',1,{}), makeEntry('alt',1,{ suspicious_alt:true })];
    const r = pickWinners(entries, 1, { seed: generateSeed(), excludeSuspicious: true });
    assert.strictEqual(r.totalEligible, 1);
    assert.strictEqual(r.winners[0].user_id, 'good');
  });
});
