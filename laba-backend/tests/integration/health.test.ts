import request from 'supertest';
import { app } from '../../src/app';

describe('GET /api/v1/health', () => {
  it('should return health status endpoint response structure', async () => {
    const res = await request(app).get('/api/v1/health');

    // Endpoint should respond with standard envelope
    expect(res.body).toHaveProperty('success');
    expect(res.body).toHaveProperty('data');
    expect(res.body.data).toHaveProperty('service', 'laba-backend-api');
    expect(res.body.data).toHaveProperty('version', '1.0.0');
    expect(res.body.data).toHaveProperty('timezone', 'Asia/Kolkata');
    expect(res.body.meta).toHaveProperty('timestamp');
  });

  it('should return 404 for nonexistent routes', async () => {
    const res = await request(app).get('/api/v1/non-existent-route-404');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

