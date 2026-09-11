import { evaluateSentence, GeminiApiError } from '../server/gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed.' }); return; }
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  console.info('[check-sentence] request received', { configured: Boolean(process.env.GEMINI_API_KEY), model });
  try {
    const result = await evaluateSentence(req.body || {}, process.env.GEMINI_API_KEY, model);
    console.info('[check-sentence] completed', { verdict: result.verdict });
    res.status(200).json(result);
  } catch (error) {
    const status = error instanceof GeminiApiError ? error.status : 500;
    console.error('[check-sentence] failed', { status, message: error?.message || 'Unknown error' });
    res.status(status).json({ error: status >= 500 ? 'Sentence checking is temporarily unavailable.' : error.message });
  }
}
