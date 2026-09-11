import { evaluateSentence, GeminiApiError } from '../server/gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed.' }); return; }
  try {
    const result = await evaluateSentence(req.body || {}, process.env.GEMINI_API_KEY, process.env.GEMINI_MODEL);
    res.status(200).json(result);
  } catch (error) {
    const status = error instanceof GeminiApiError ? error.status : 500;
    res.status(status).json({ error: status >= 500 ? 'Sentence checking is temporarily unavailable.' : error.message });
  }
}
