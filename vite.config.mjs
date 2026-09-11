import { defineConfig, loadEnv } from 'vite';
import { evaluateSentence, GeminiApiError } from './server/gemini.js';

function readBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 20000) reject(new GeminiApiError('Request is too large.', 413));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(raw || '{}')); } catch { reject(new GeminiApiError('Invalid JSON request.', 400)); }
    });
    req.on('error', reject);
  });
}

function checkSentenceApi(env) {
  return async (req, res, next) => {
    if (req.url !== '/api/check-sentence') return next();
    if (req.method !== 'POST') { res.statusCode = 405; res.setHeader('Allow', 'POST'); res.end(); return; }
    try {
      const body = await readBody(req);
      const result = await evaluateSentence(body, env.GEMINI_API_KEY, env.GEMINI_MODEL);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(result));
    } catch (error) {
      const status = error instanceof GeminiApiError ? error.status : 500;
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: status >= 500 ? 'Sentence checking is temporarily unavailable.' : error.message }));
    }
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return { plugins: [{ name: 'sentence-check-api', configureServer(server) { server.middlewares.use(checkSentenceApi(env)); } }] };
});
