import { evaluateSentence, GeminiApiError } from '../server/gemini.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed.' }); return; }
  const model = process.env.GEMINI_MODEL || 'gemini-3.6-flash';
  const fallbackModel = process.env.GEMINI_FALLBACK_MODEL || 'gemini-3.5-flash-lite';
  console.info('[check-sentence] request received', { configured: Boolean(process.env.GEMINI_API_KEY), model });
  try {
    let result;
    let usedModel = model;
    try {
      result = await evaluateSentence(req.body || {}, process.env.GEMINI_API_KEY, model);
    } catch (error) {
      const isCapacityError = error instanceof GeminiApiError && error.status === 502 && /demand|temporarily|unavailable|overloaded/i.test(error.message);
      if (!isCapacityError || model === fallbackModel) throw error;
      console.warn('[check-sentence] primary model unavailable; trying fallback', { fallbackModel });
      result = await evaluateSentence(req.body || {}, process.env.GEMINI_API_KEY, fallbackModel);
      usedModel = fallbackModel;
    }
    console.info('[check-sentence] completed', { verdict: result.verdict, model: usedModel });
    res.status(200).json(result);
  } catch (error) {
    const status = error instanceof GeminiApiError ? error.status : 500;
    console.error('[check-sentence] failed', { status, message: error?.message || 'Unknown error' });
    res.status(status).json({ error: status >= 500 ? 'Sentence checking is temporarily unavailable.' : error.message });
  }
}
