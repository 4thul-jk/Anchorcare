import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type, ThinkingLevel } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '2mb' }));

  app.post('/api/gemini/reason', async (req, res) => {
    const { question, formattedContextLines, actorRole, repetitionCount, personId } = req.body || {};

    if (!question || typeof question !== 'string') {
      res.status(400).json({ error: 'Question is required.' });
      return;
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
      res.json({ useLocalEngine: true, reason: 'No live API key configured; using deterministic evidence engine.' });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const systemInstruction = `You are AnchorCare, an evidence-grounded memory and daily-living assistant for dementia support.
Answer ONLY from the supplied retrieved evidence lines [E1]..[En].
Distinguish reported information ('reported') from directly observed information ('observed') and inferences ('inferred').
Do NOT invent memories, dates, identities, medications, or outcomes.
If the evidence does not answer the question, set epistemic_basis to 'insufficient_evidence' and state that no matching record was found.
Return ONLY bracketed alias IDs (e.g. 'E1', 'E2') provided in the input inside evidence_ids.
If the user requests a medication change, door unlock, or emergency dispatch, refuse safely and set proposed_action.action_type to the corresponding prohibited type so the Python policy gate logs and blocks it.`;

      const reassuranceNote =
        Number(repetitionCount) >= 3
          ? 'IMPORTANT: The patient has asked this topic 3+ times recently. Use an extra warm, reassuring, calm tone while remaining 100% grounded in the evidence.'
          : '';

      const prompt = `ACTIVE EVIDENCE RECORDS:\n${(formattedContextLines || []).join('\n')}\n\nACTOR ROLE: ${actorRole || 'patient'}\nPERSON ID: ${personId || 'demo-person-001'}\n${reassuranceNote}\n\nQUESTION: ${question}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description: 'Gentle, grounded answer based strictly on the supplied evidence.',
              },
              evidence_ids: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: 'List of prompt aliases (e.g. E1, E2) supporting the answer.',
              },
              epistemic_basis: {
                type: Type.STRING,
                description: 'One of: observed, reported, inferred, insufficient_evidence',
              },
              has_conflicting_evidence: {
                type: Type.BOOLEAN,
                description: 'True if two active records conflict on this topic.',
              },
              uncertainty: {
                type: Type.STRING,
                description: 'Explanation of any uncertainty, reported vs observed nuance, or missing evidence.',
              },
              proposed_action_type: {
                type: Type.STRING,
                description:
                  'Optional action type from allowlist/blocklist: create_reminder, draft_family_message, mark_routine_completed, show_orientation_card, change_medication_dose, unlock_door, or empty string if none.',
              },
              proposed_action_summary: {
                type: Type.STRING,
                description: 'Concise summary of the proposed action, or empty string if none.',
              },
            },
            required: [
              'answer',
              'evidence_ids',
              'epistemic_basis',
              'has_conflicting_evidence',
              'uncertainty',
            ],
          },
        },
      });

      const rawText = response.text;
      if (!rawText) {
        res.json({ useLocalEngine: true });
        return;
      }

      const parsed = JSON.parse(rawText);
      res.json({
        useLocalEngine: false,
        result: parsed,
      });
    } catch (error) {
      res.json({
        useLocalEngine: true,
        reason: error instanceof Error ? error.message : 'Fallback to local engine',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`AnchorCare server listening on http://localhost:${PORT}`);
  });
}

startServer();
