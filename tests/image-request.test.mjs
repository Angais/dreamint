import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { gpt25Size } from '../.test-build/lib/image-options.js';
import { buildImageRequest } from '../.test-build/lib/image-request.js';
import { POST } from '../.test-build/api/openrouter/images/route.js';
import { generateImage } from '../.test-build/lib/generate-image.js';
const fixtures = ['sunburst', 'flare'].map((name) =>
  JSON.parse(readFileSync(new URL(`./fixtures/${name}.json`, import.meta.url), 'utf8')),
);
const defaults = { prompt: 'A leaf', numImages: 1, inputReferences: [] };

for (const fixture of fixtures) {
  const parameters = fixture.endpoints[0].supported_parameters;
  test(`${fixture.id}: old retries omit unsupported resolution and format`, () => {
    const body = buildImageRequest({ ...defaults, model: fixture.id, resolution: '2K', outputFormat: 'jpeg', quality: 'high', aspectRatio: '9:16' }, parameters);
    assert.equal(body.resolution, undefined);
    assert.equal(body.output_format, undefined);
    assert.equal(body.quality, 'high');
    assert.equal(body.aspect_ratio, '9:16');
    assert.equal(body.background, 'auto');
  });
  test(`${fixture.id}: transparent backgrounds and references survive`, () => {
    const body = buildImageRequest({ ...defaults, model: fixture.id, background: 'transparent', quality: 'max', inputReferences: ['data:image/png;base64,ref'] }, parameters);
    assert.equal(body.background, 'transparent');
    assert.equal(body.quality, 'max');
    assert.equal(body.input_references[0].image_url.url, 'data:image/png;base64,ref');
  });
}

test('transparency switches a supported JPEG output to an alpha format', () => {
  const body = buildImageRequest({ ...defaults, model: fixtures[0].id, background: 'transparent', outputFormat: 'jpeg' }, {
    background: { type: 'enum', values: ['auto', 'transparent'] },
    output_format: { type: 'enum', values: ['jpeg', 'webp'] },
  });
  assert.equal(body.output_format, 'webp');
});

test('unsupported transparency and excess references fail before billing', () => {
  assert.throws(() => buildImageRequest({ ...defaults, background: 'transparent' }, {}), /does not support transparent/);
  assert.throws(() => buildImageRequest({ ...defaults, inputReferences: ['ref'] }, {}), /Too many reference/);
  assert.throws(() => buildImageRequest({ ...defaults, numImages: 4 }, {}), /fewer images/);
});

test('proxy validates a retry against live endpoint metadata and keeps provider pinning', async (t) => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (url.endsWith('/endpoints')) return Response.json(fixtures[0]);
    sent = JSON.parse(init.body);
    return Response.json({ data: [{ b64_json: 'image', media_type: 'image/png' }] });
  });
  const response = await POST(new Request('http://localhost/api/openrouter/images', {
    method: 'POST', body: JSON.stringify({ apiKey: 'test-key', model: fixtures[0].id, prompt: 'leaf', outputFormat: 'jpeg', resolution: '2K', background: 'transparent', providerTag: 'openai', allowFallbacks: false }),
  }));
  assert.equal(response.status, 200);
  assert.equal(sent.background, 'transparent');
  assert.equal(sent.output_format, undefined);
  assert.equal(sent.resolution, undefined);
  assert.deepEqual(sent.provider, { only: ['openai'], allow_fallbacks: false });
});

test('proxy returns a structured connection error', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('fetch failed'); });
  const response = await POST(new Request('http://localhost/api/openrouter/images', {
    method: 'POST', body: JSON.stringify({ apiKey: 'test-key', model: fixtures[1].id, prompt: 'leaf' }),
  }));
  assert.equal(response.status, 502);
  assert.match((await response.json()).error.message, /Unable to reach OpenRouter/);
});

test('client forwards explicit background and preserves returned PNG data and cost', async (t) => {
  let sent;
  t.mock.method(globalThis, 'fetch', async (_url, init) => {
    sent = JSON.parse(init.body);
    return Response.json({ data: [{ b64_json: 'image', media_type: 'image/png' }], usage: { cost: 0.03 } });
  });
  const result = await generateImage({ apiKey: 'test-key', model: fixtures[1].id, prompt: 'leaf', background: 'transparent' });
  assert.equal(sent.background, 'transparent');
  assert.deepEqual(result.images, ['data:image/png;base64,image']);
  assert.equal(result.usage.costUsd, 0.03);
});

test('explicit 4K dimensions reach OpenRouter with image references', () => {
  for (const fixture of fixtures) {
    const body = buildImageRequest({ ...defaults, model: fixture.id, aspectRatio: '9:16', resolution: '4K', size: '2160x3840', inputReferences: ['data:image/png;base64,ref'] }, fixture.endpoints[0].supported_parameters);
    assert.equal(body.size, '2160x3840');
    assert.equal(body.aspect_ratio, undefined);
    assert.equal(body.resolution, undefined);
    assert.equal(body.input_references.length, 1);
  }
});

test('2560 × 1600 preset preserves exact dimensions for any reference ratio', () => {
  for (const ratio of [1, 9 / 16, 16 / 9]) {
    assert.equal(gpt25Size('2560x1600', ratio), '2560x1600');
  }
  for (const fixture of fixtures) {
    const body = buildImageRequest({ ...defaults, model: fixture.id, size: '2560x1600', inputReferences: ['data:image/png;base64,ref'] }, fixture.endpoints[0].supported_parameters);
    assert.equal(body.size, '2560x1600');
  }
});
