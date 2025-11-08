const path = require('path')
const supertest = require('supertest')

let app, request
let memoryTickets

// Minimal fake Discord client to satisfy server guards
function makeFakeDiscord(){
  const message = (id, ts, author, content) => ({ id, createdTimestamp: ts, author: { username: author.split('#')[0], discriminator: author.split('#')[1]||'0000' }, content })
  const fakeChannel = {
    messages: {
      async fetch(opts){
        // Simulate a single page of 3 messages
        const batch = [
          message('m3', Date.now() - 1000 * 60 * 3, 'User#0001', 'hello'),
          message('m2', Date.now() - 1000 * 60 * 2, 'Mod#0002', 'how can I help?'),
          message('m1', Date.now() - 1000 * 60 * 1, 'User#0001', 'issue resolved, thanks!'),
        ]
        return { size: batch.length, values: () => batch }
      }
    }
  }
  const guild = {
    id: 'g1',
    members: {
      async fetch(userId){
        return { id: userId, roles: { cache: new Map() } }
      }
    },
    channels: { cache: new Map([['c1', fakeChannel], ['c2', fakeChannel]]) }
  }
  return {
    guilds: { cache: new Map([['g1', guild]]) }
  }
}

describe('dashboard: transcript & feedback endpoints', () => {
  beforeAll(async () => {
    // Ensure JSON storage backend is used and dashboard does not try to listen
    process.env.STORAGE_BACKEND = 'json'
    process.env.CLIENT_SECRET = 'bot_only'
    // In-memory tickets instead of hitting fs-backed storage
    memoryTickets = [
      { id: 1001, guild_id: 'g1', channel_id: 'c1', user_id: '0', status: 'closed', meta: { transcript: { text: 'stored transcript text', html: '<html><body>stored</body></html>', generatedAt: new Date().toISOString(), messageCount: 3 } } },
      { id: 1002, guild_id: 'g1', channel_id: 'c2', user_id: '0', status: 'closed', meta: {} },
      { id: 1003, guild_id: 'g1', channel_id: 'c2', user_id: 'someone', status: 'closed', meta: {} },
    ]

    // Mock utils/storage module as required by server.js
    const storagePath = require.resolve('../../utils/storage')
    jest.resetModules()
    // Prevent Next standalone child process from spawning during tests
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

    app = require('../../dashboard/server')
    request = supertest(app)
  })

  afterAll(() => {})

  it('serves stored transcript (txt)', async () => {
    const res = await request.get('/api/guild/g1/tickets/1001/transcript?format=txt').set('x-dev-bypass', '1')
    expect(res.status).toBe(200)
    expect(res.text).toContain('stored transcript text')
    expect(res.headers['content-type']).toMatch(/text\/plain/)
  })

  it('serves stored transcript (html)', async () => {
    const res = await request.get('/api/guild/g1/tickets/1001/transcript?format=html').set('x-dev-bypass', '1')
    expect(res.status).toBe(200)
    expect(res.text).toContain('<html>')
    expect(res.headers['content-type']).toMatch(/text\/html/)
  })

  it('generates on-the-fly transcript when missing', async () => {
    const res = await request.get('/api/guild/g1/tickets/1002/transcript?format=txt').set('x-dev-bypass', '1')
    expect(res.status).toBe(200)
    expect(res.text).toContain('Ticket #1002 (on-the-fly)')
    expect(res.text).toContain('User#0001')
  })

  it('regenerates transcript and persists meta', async () => {
    // Before regenerate, no stored transcript for ticket 1002
  const pre = await request.get('/api/guild/g1/tickets/1002/transcript?format=html').set('x-dev-bypass', '1')
  // When no stored HTML exists, server falls back to on-the-fly TXT (200)
  expect(pre.status).toBe(200)
  expect(pre.headers['content-type']).toMatch(/text\/plain/)
    const regen = await request.post('/api/guild/g1/tickets/1002/transcript/regenerate').set('x-dev-bypass', '1')
    expect(regen.status).toBe(200)
    expect(regen.body.success).toBe(true)
    expect(regen.body.transcript?.messageCount).toBeGreaterThan(0)
    // After regenerate, HTML should now be available
    const post = await request.get('/api/guild/g1/tickets/1002/transcript?format=html').set('x-dev-bypass', '1')
    expect(post.status).toBe(200)
    expect(post.text).toContain('<html')
  })

  it('accepts valid feedback from owner', async () => {
    const res = await request
      .post('/api/guild/g1/tickets/1001/feedback')
      .set('x-dev-bypass', '1')
      .send({ rating: 5, comment: 'Great help!' })
    expect(res.status).toBe(200)
    expect(res.body.success).toBe(true)
    expect(res.body.feedback.rating).toBe(5)
  })

  it('rejects invalid rating (400)', async () => {
    const res = await request
      .post('/api/guild/g1/tickets/1001/feedback')
      .set('x-dev-bypass', '1')
      .send({ rating: 0 })
    expect(res.status).toBe(400)
  })

  it('rejects non-owner/non-staff feedback (403)', async () => {
    const res = await request
      .post('/api/guild/g1/tickets/1003/feedback')
      .set('x-dev-bypass', '1')
      .send({ rating: 4 })
    expect(res.status).toBe(403)
  })
})
