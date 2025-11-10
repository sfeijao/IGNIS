/**
 * Jest integration test for webhook activation (SQLite fallback) using test mode.
 * Skips real network by stubbing node-fetch.
 */
process.env.NODE_ENV = 'test';
process.env.DASHBOARD_TEST_MODE = 'true';
process.env.DASHBOARD_BYPASS_AUTH = 'true';
process.env.STORAGE_BACKEND = 'sqlite';
process.env.MONGO_URI = '';
process.env.MONGODB_URI = '';

// Stub node-fetch to avoid external HTTP calls and always succeed
jest.mock('node-fetch', () => jest.fn(async () => ({
  ok: true,
  status: 200,
  json: async () => ({ ok: true }),
  text: async () => 'ok'
})));

const request = require('supertest');
const path = require('path');
// Require the express app AFTER stubbing fetch
const app = require(path.join(__dirname, '..', '..', 'dashboard', 'server'));

const guildId = 'test';

describe('Webhook activation flow (SQLite fallback)', () => {
  let createdId = null;

  test('Create webhook returns disabled item', async () => {
    const res = await request(app)
      .post(`/api/guild/${guildId}/webhooks`)
      .send({ type: 'transcript', url: 'https://example.com/webhook' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.item).toBeDefined();
    expect(res.body.item.enabled).toBe(false); // always disabled until tested
    createdId = res.body.item.id;
  });

  test('Test & activate endpoint enables webhook and records status', async () => {
    const res = await request(app)
      .post(`/api/guild/${guildId}/webhooks/${createdId}/test-activate`)
      .send({ payload: { activation: true } });
    // Debug output
    // eslint-disable-next-line no-console
    console.log('TEST-ACTIVATE RESPONSE', res.status, res.body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const item = res.body.item;
    expect(item.enabled).toBe(true);
    expect(item.lastOk).toBe(true);
    expect(item.lastStatus).toBe(200);
    expect(item.lastAt).toBeTruthy();
  });

  test('List webhooks shows updated status fields', async () => {
    const res = await request(app)
      .get(`/api/guild/${guildId}/webhooks`);
    // eslint-disable-next-line no-console
    console.log('LIST RESPONSE', res.status, res.body);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const items = res.body.items;
    expect(Array.isArray(items)).toBe(true);
    const found = items.find(i => i.id === createdId);
    expect(found).toBeDefined();
    expect(found.lastOk).toBe(true);
    expect(found.lastStatus).toBe(200);
  });
});
