import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { CompanionView } from '../components/CompanionView';
import { createInitialState } from './caregiverEngine';
test('historical answers hide obsolete evidence and reassurance banners together', () => {
  const state = createInitialState();
  state.sessionTurns[0] = { ...state.sessionTurns[0], answer_version: undefined, question: 'Did the physical therapist visit me yesterday evening?', is_reassurance_mode: true };
  const html = renderToStaticMarkup(<CompanionView state={state} watchdogAlerts={[]} isAsking={false} onAskQuestion={async () => {}} onSimulateRepetitiveLoop={async () => {}} onToggleOrientationCard={() => {}} onNavigateTab={() => {}} />);
  assert.match(html, /Check this question again/);
  assert.doesNotMatch(html, /Verified Supporting Evidence Records/);
  assert.doesNotMatch(html, /Tier 1 Autonomous Loop Detector Activated/);
});
