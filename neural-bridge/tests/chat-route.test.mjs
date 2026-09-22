import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import Module, { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filename = path.resolve(__dirname, '../app/api/chat/route.ts');
const compiled = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const route = new Module(filename);
route.paths = require.resolve.paths('next/server');
route._compile(compiled, filename);
const { POST } = route.exports;
const request = (body) => new Request('http://localhost/api/chat', { method: 'POST', body: JSON.stringify(body) });
const messages = [{ role: 'user', content: 'Hello', images: ['iVBORtest'] }];

test('chat providers and validation', async (t) => {
  const originalFetch = global.fetch;
  const previous = { ...process.env };
  process.env.MODAL_ENDPOINT = 'https://example.modal.direct/';
  process.env.MODAL_KEY = 'test-key';
  process.env.MODAL_SECRET = 'test-secret';
  delete process.env.MODAL_MODEL;
  t.after(() => { global.fetch = originalFetch; process.env = previous; });

  await t.test('Modal discovery, server-controlled destination, images, usage', async () => {
    const calls = [];
    global.fetch = async (url, options) => {
      calls.push({ url, options });
      return Response.json(calls.length === 1 ? { data: [{ id: 'served-model' }] } : {
        choices: [{ message: { content: 'Hello back' } }], usage: { prompt_tokens: 3, completion_tokens: 2 },
      });
    };
    const response = await POST(request({ provider: 'modal', url: 'https://untrusted.invalid', model: 'ignored', messages }));
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { message: { role: 'assistant', content: 'Hello back' }, prompt_eval_count: 3, eval_count: 2 });
    assert.equal(calls[0].url, 'https://example.modal.direct/v1/models');
    assert.equal(calls[1].url, 'https://example.modal.direct/v1/chat/completions');
    assert.equal(calls[1].options.headers.Authorization, 'Bearer test-key.test-secret');
    assert.equal(calls[1].options.redirect, 'error');
    const body = JSON.parse(calls[1].options.body);
    assert.equal(body.model, 'served-model');
    assert.equal(body.messages[0].content[1].image_url.url, 'data:image/png;base64,iVBORtest');
  });
  await t.test('Ollama remains compatible and never receives Modal credentials', async () => {
    global.fetch = async (url, options) => {
      assert.equal(url, 'http://localhost:11434/api/chat');
      assert.equal(options.headers.Authorization, undefined);
      assert.equal(options.headers['Modal-Key'], undefined);
      assert.deepEqual(JSON.parse(options.body).messages, messages);
      return Response.json({ message: { content: 'ok' } });
    };
    assert.equal((await POST(request({ url: 'http://localhost:11434/', model: 'local', messages }))).status, 200);
  });
  await t.test('invalid input returns 400', async () => {
    for (const body of [null, {}, { messages: [null] }, { messages, provider: 'unknown' }]) {
      assert.equal((await POST(request(body))).status, 400);
    }
  });
  await t.test('upstream failures do not expose diagnostics', async () => {
    process.env.MODAL_MODEL = 'configured-model';
    global.fetch = async () => new Response('sensitive upstream diagnostics', { status: 401 });
    const response = await POST(request({ provider: 'modal', messages }));
    assert.equal(response.status, 401);
    assert.equal((await response.text()).includes('sensitive'), false);
  });
  await t.test('timeouts and empty replies are explicit errors', async () => {
    global.fetch = async () => { throw new DOMException('timeout', 'TimeoutError'); };
    assert.equal((await POST(request({ provider: 'modal', messages }))).status, 504);
    global.fetch = async () => Response.json({ choices: [] });
    assert.equal((await POST(request({ provider: 'modal', messages }))).status, 502);
  });
  await t.test('missing credentials fail before fetching', async () => {
    delete process.env.MODAL_SECRET;
    global.fetch = async () => { assert.fail('should not fetch'); };
    assert.equal((await POST(request({ provider: 'modal', messages }))).status, 503);
  });
});
