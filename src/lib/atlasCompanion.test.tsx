import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { AtlasCompanionView } from '../components/AtlasCompanionView';
import { memoryApi } from './memoryApi';
test('primary companion does not render fictional browser assertions before authenticating', () => {
  const html = renderToStaticMarkup(<AtlasCompanionView accessKey="" onAccessKeyChange={() => {}} />);
  assert.match(html, /Your memory companion/); assert.match(html, /Connect companion/);
  assert.doesNotMatch(html, /4:30|safe at home|Lisinopril|Sam Rivera is with you/);
});
test('API failures are surfaced rather than falling back to browser answers', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = (async () => ({ ok: false, json: async () => ({ error: 'Memory temporarily unavailable' }) })) as any;
  try { await assert.rejects(memoryApi('test-key', '/ask', { question: 'Who visited?' }), /Memory temporarily unavailable/); }
  finally { globalThis.fetch = original; }
});
