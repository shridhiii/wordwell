const MAX_LENGTH = 4000;

export class GeminiApiError extends Error {
  constructor(message, status = 502) {
    super(message);
    this.name = 'GeminiApiError';
    this.status = status;
  }
}

const schema = {
  type: 'OBJECT',
  properties: {
    verdict: { type: 'STRING', enum: ['correct', 'needs_revision', 'uncertain'] },
    explanation: { type: 'STRING' },
    suggestedRevision: { type: 'STRING' },
    confidence: { type: 'NUMBER', minimum: 0, maximum: 1 },
  },
  required: ['verdict', 'explanation', 'suggestedRevision', 'confidence'],
};

function clean(value, label) {
  if (typeof value !== 'string' || !value.trim() || value.length > MAX_LENGTH) {
    throw new GeminiApiError(`Invalid ${label}.`, 400);
  }
  return value.trim();
}

function parseResult(payload) {
  const text = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string') throw new GeminiApiError('Gemini returned no review.', 502);

  let result;
  try {
    result = JSON.parse(text);
  } catch {
    throw new GeminiApiError('Gemini returned an invalid review.', 502);
  }

  const validVerdicts = ['correct', 'needs_revision', 'uncertain'];
  if (!validVerdicts.includes(result.verdict) || typeof result.explanation !== 'string') {
    throw new GeminiApiError('Gemini returned an incomplete review.', 502);
  }

  return {
    verdict: result.verdict,
    explanation: result.explanation.trim().slice(0, 1000),
    suggestedRevision: typeof result.suggestedRevision === 'string' ? result.suggestedRevision.trim().slice(0, 1000) : '',
    confidence: Number.isFinite(Number(result.confidence)) ? Math.min(1, Math.max(0, Number(result.confidence))) : 0.5,
  };
}

export async function evaluateSentence({ term, definition, sentence }, apiKey, model = 'gemini-3.6-flash') {
  if (!apiKey) throw new GeminiApiError('Gemini API key is not configured.', 500);
  const safeTerm = clean(term, 'word');
  const safeDefinition = clean(definition, 'definition');
  const safeSentence = clean(sentence, 'sentence');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  let response;
  try {
    response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: 'You are a careful English vocabulary tutor. Judge whether the sentence uses the target word with the intended meaning from the saved definition. Check semantic meaning and naturalness, not just whether the word appears. A sentence that states an opposite meaning is incorrect; for example, lucid means clear and easy to understand, not hard to understand. Be encouraging but honest. Return only JSON matching the provided schema.' }],
        },
        contents: [{ role: 'user', parts: [{ text: JSON.stringify({ word: safeTerm, savedDefinition: safeDefinition, learnerSentence: safeSentence }) }] }],
        generationConfig: { responseMimeType: 'application/json', responseSchema: schema, temperature: 0.1 },
      }),
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw new GeminiApiError('Gemini took too long to respond. Please try again.', 504);
    throw new GeminiApiError('Could not reach Gemini. Please try again.', 502);
  } finally {
    clearTimeout(timeout);
  }

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.error?.message || 'Gemini request failed.';
    throw new GeminiApiError(detail, response.status >= 400 && response.status < 500 ? response.status : 502);
  }
  return parseResult(payload);
}
