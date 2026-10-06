import { createHmac } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { makeModeCookie, requireReview, requireReviewPreview, validateReviewCredentials, validateReviewPreviewCredentials } from '../lib/server/demo-auth';
import { POST as reviewPost } from '../app/api/incidents/[incidentId]/review/route';

const originalUsername = process.env.DEMO_REVIEW_USERNAME;
const originalSecret = process.env.DEMO_REVIEW_SECRET;
const originalPreviewUsername = process.env.DEMO_REVIEW_PREVIEW_USERNAME;
const originalPreviewSecret = process.env.DEMO_REVIEW_PREVIEW_SECRET;

function setup() {
  process.env.DEMO_REVIEW_USERNAME = 'test-reviewer';
  process.env.DEMO_REVIEW_SECRET = 'local-test-password-only';
  process.env.DEMO_REVIEW_PREVIEW_USERNAME = 'judge-preview';
  process.env.DEMO_REVIEW_PREVIEW_SECRET = 'public-preview-password';
}

function request(cookie?: string, reviewHeader?: string, cookieName = 'istithbat_review') {
  return new NextRequest('https://example.test/api/incidents/00000000-0000-4000-8000-000000000001/review', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(cookie ? { cookie: `${cookieName}=${cookie}` } : {}),
      ...(reviewHeader ? { 'x-demo-review-secret': reviewHeader } : {}),
    },
    body: JSON.stringify({ decision: 'APPROVE', reviewer: 'forged-name' }),
  });
}

afterEach(() => {
  if (originalUsername === undefined) delete process.env.DEMO_REVIEW_USERNAME;
  else process.env.DEMO_REVIEW_USERNAME = originalUsername;
  if (originalSecret === undefined) delete process.env.DEMO_REVIEW_SECRET;
  else process.env.DEMO_REVIEW_SECRET = originalSecret;
  if (originalPreviewUsername === undefined) delete process.env.DEMO_REVIEW_PREVIEW_USERNAME;
  else process.env.DEMO_REVIEW_PREVIEW_USERNAME = originalPreviewUsername;
  if (originalPreviewSecret === undefined) delete process.env.DEMO_REVIEW_PREVIEW_SECRET;
  else process.env.DEMO_REVIEW_PREVIEW_SECRET = originalPreviewSecret;
});

describe('reviewer authentication', () => {
  it('requires both fields, then accepts the signed 12-hour cookie across requests', () => {
    setup();
    expect(validateReviewCredentials('test-reviewer', 'local-test-password-only')).toBe(true);
    expect(validateReviewCredentials('other', 'local-test-password-only')).toBe(false);
    expect(validateReviewCredentials('test-reviewer', 'wrong')).toBe(false);
    const cookie = makeModeCookie('review');
    expect(cookie.options.httpOnly).toBe(true);
    expect(cookie.options.maxAge).toBe(12 * 60 * 60);
    expect(requireReview(request(cookie.value))).toBe(true);
    expect(requireReview(request(cookie.value))).toBe(true);
    delete process.env.DEMO_REVIEW_USERNAME;
    expect(requireReview(request(cookie.value))).toBe(false);
  });

  it('rejects expired, tampered and legacy header-only review authorization', async () => {
    setup();
    const expiredPayload = `review.${Date.now() - 1000}`;
    const signature = createHmac('sha256', process.env.DEMO_REVIEW_SECRET!).update(expiredPayload).digest('hex');
    expect(requireReview(request(`${expiredPayload}.${signature}`))).toBe(false);
    const cookie = makeModeCookie('review').value;
    expect(requireReview(request(`${cookie.slice(0, -1)}${cookie.endsWith('0') ? '1' : '0'}`))).toBe(false);
    expect(requireReview(request(undefined, process.env.DEMO_REVIEW_SECRET))).toBe(false);
    const context = { params: Promise.resolve({ incidentId: '00000000-0000-4000-8000-000000000001' }) };
    expect((await reviewPost(request(), context)).status).toBe(401);
    expect((await reviewPost(request(undefined, process.env.DEMO_REVIEW_SECRET), context)).status).toBe(401);
  });

  it('lets the public judge authenticate for preview but never sign or append a decision', async () => {
    setup();
    expect(validateReviewPreviewCredentials('judge-preview', 'public-preview-password')).toBe(true);
    expect(validateReviewCredentials('judge-preview', 'public-preview-password')).toBe(false);
    const cookie = makeModeCookie('review_preview');
    const previewRequest = request(cookie.value, undefined, cookie.name);
    expect(requireReviewPreview(previewRequest)).toBe(true);
    expect(requireReview(previewRequest)).toBe(false);
    const context = { params: Promise.resolve({ incidentId: '00000000-0000-4000-8000-000000000001' }) };
    expect((await reviewPost(previewRequest, context)).status).toBe(401);
  });
});
