const supertest = require('supertest')
const logger = require('../utils/logger');

let app, request
let memoryTickets

function makeFakeDiscord(){
  const guild = {
    id: 'g1',
    members: { async fetch(userId){ return { id: userId, roles: { cache: new Map() } } } },
    channels: { cache: new Map() }
  }
  return { guilds: { cache: new Map([['g1', guild]]) } }
}

describe('dashboard: ticket priority action', () => {
  beforeAll(async () => {
    // Capture intervals so we can clear them and let Jest exit cleanly
    const originalSetInterval = global.setInterval;
    global.__capturedIntervals = [];
    // @ts-ignore
    global.setInterval = (fn, ms, ...rest) => {
      const id = originalSetInterval(fn, ms, ...rest);
      global.__capturedIntervals.push(id);
      return id;
    };
    process.env.STORAGE_BACKEND = 'json'
    process.env.CLIENT_SECRET = 'bot_only'
    memoryTickets = [
      { id: 2001, guild_id: 'g1', channel_id: 'c1', user_id: 'u1', status: 'open', priority: 'normal', created_at: new Date().toISOString() },
      { id: 2002, guild_id: 'g1', channel_id: 'c2', user_id: 'u2', status: 'claimed', assigned_to: 'u9', priority: 'high', created_at: new Date().toISOString() },
    ]

    const storagePath = require.resolve('../../utils/storage')
    jest.resetModules()
    jest.doMock('child_process', () => ({ spawn: () => ({ kill: () => {} }) }), { virtual: false })
    jest.doMock(storagePath, () => ({
      __esModule: false,
      getTickets: async (guildId) => memoryTickets.filter(t => t.guild_id === guildId),
      updateTicket: async (ticketId, updates) => {
        const idx = memoryTickets.findIndex(t => `${t.id}` === `${ticketId}`)
        if (idx >= 0) memoryTickets[idx] = { ...memoryTickets[idx], ...updates }
        return memoryTickets[idx]
      },
      getGuildConfig: async () => ({ staffRoles: [] }),
      addTicketLog: async () => {}
    }), { virtual: false })

    global.discordClient = makeFakeDiscord()

    // Monkey-patch giveaway worker init to avoid lingering timeouts
    const workerPath = require.resolve('../../utils/giveaways/worker.js')
    jest.doMock(workerPath, () => ({
      __esModule: false,
      initGiveawayWorker: () => () => {}
    }), { virtual: false })
    app = require('../../dashboard/server')
    request = supertest(app)
  })

  afterAll(() => {
    try {
      // Clear captured intervals
      // @ts-ignore
      for (const id of global.__capturedIntervals || []) clearInterval(id)
    } catch (e) { logger.debug('Caught error:', e?.message || e); }
    // Best-effort: close any server listener if returned
    try { if (app && app.close) app.close() } catch (e) { logger.debug('Caught error:', e?.message || e); }
  })

  it('updates priority via ticket action', async () => {
    // simulate authenticated session bypass
    const res = await request
      .post('/api/guild/g1/tickets/2001/action')
      .set('x-dev-bypass', '1')
      .send({ action: 'priority', data: { value: 'urgent' } })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    // check memory
    const t = memoryTickets.find(t => t.id === 2001)
    expect(t.priority).toBe('urgent')
  })
})
