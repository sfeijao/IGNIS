const assert = require('assert')
const express = require('express')
const bodyParser = require('body-parser')
const supertest = require('supertest')
const { MongoMemoryServer } = require('mongodb-memory-server')
const mongoose = require('mongoose')

let app, server, request

// Mount only the giveaways router for focused tests
async function makeApp(){
  app = express()
  app.use(bodyParser.json())
  // Fake auth middleware
  app.use((req,res,next)=>{ req.user = { id: 'tester', admin: true, manageGuilds: ['g1'] }; req.isAuthenticated = () => true; next() })
  const router = require('../../dashboard/routes/giveawayRoutes')
  app.use('/api', router)
  server = app.listen(0)
  request = supertest(server)
}

describe('giveaways integration', () => {
  jest.setTimeout(30000)
  let mongo

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create()
    const uri = mongo.getUri()
    await mongoose.connect(uri)
    await makeApp()
  })

  afterAll(async () => {
    await mongoose.disconnect()
    if (mongo) await mongo.stop()
    if (server) server.close()
  })

  let createdId

  it('create → list → get', async () => {
    const ends_at = new Date(Date.now() + 60_000).toISOString()
    const res = await request.post('/api/guilds/g1/giveaways').send({ title: 'Test', description: 'X', winners_count: 1, ends_at })
    assert.strictEqual(res.status, 200)
    assert(res.body.giveaway && res.body.giveaway._id)
    createdId = res.body.giveaway._id

    const list = await request.get('/api/guilds/g1/giveaways?status=active')
    assert.strictEqual(list.status, 200)
    assert(list.body.giveaways.some(g => g._id === createdId))

    const detail = await request.get(`/api/guilds/g1/giveaways/${createdId}`)
    assert.strictEqual(detail.status, 200)
    assert.strictEqual(detail.body.entriesCount, 0)
  })

  it('enter user', async () => {
    const res = await request.post(`/api/guilds/g1/giveaways/${createdId}/enter`).send({ user_id: 'u1', username: 'User 1' })
    assert.strictEqual(res.status, 200)
    assert(res.body.ok)
    const detail = await request.get(`/api/guilds/g1/giveaways/${createdId}`)
    assert.strictEqual(detail.body.entriesCount, 1)
  })

  it('end now and reroll', async () => {
    const end = await request.post(`/api/guilds/g1/giveaways/${createdId}/end`).send({})
    assert.strictEqual(end.status, 200)
    assert(end.body.ok)
    const reroll = await request.post(`/api/guilds/g1/giveaways/${createdId}/reroll`).send({ count: 1 })
    assert.strictEqual(reroll.status, 200)
    assert(reroll.body.ok)
  })
})
