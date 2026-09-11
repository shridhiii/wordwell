import './style.css';
import { supabase, supabaseConfigured } from './supabase.js';

const seedWords = [
  { id: '1', term: 'serendipity', definition: 'A fortunate discovery made by accident.', note: 'Found this while reading about inventions.', level: 2, nextReview: Date.now() },
  { id: '2', term: 'lucid', definition: 'Clear and easy to understand.', note: '', level: 1, nextReview: Date.now() },
  { id: '3', term: 'meticulous', definition: 'Very careful and precise about small details.', note: '', level: 0, nextReview: Date.now() },
];

const dailyWordPool = [
  ['ephemeral', 'Lasting for a very short time.'],
  ['pragmatic', 'Focused on practical results rather than theory.'],
  ['eloquent', 'Fluent or persuasive in speaking or writing.'],
  ['ambivalent', 'Having mixed or uncertain feelings.'],
  ['resilient', 'Able to recover quickly from difficulty.'],
  ['conspicuous', 'Easy to notice or attract attention.'],
  ['nuance', 'A subtle difference in meaning or expression.'],
  ['diligent', 'Showing steady, careful effort.'],
  ['impartial', 'Fair and not favoring one side.'],
  ['vivid', 'Producing strong, clear images or impressions.'],
  ['coherent', 'Logical, consistent, and easy to understand.'],
  ['versatile', 'Able to adapt to many different uses or activities.'],
];

let words = [];
let currentUser = null;
let authMode = 'login';
let authMessage = '';
let activeTab = 'home';
let reviewQueue = [];
let reviewIndex = 0;
let meaningRevealed = false;
let toastTimer;

const app = document.querySelector('#app');
const localKey = () => currentUser ? `wordwell-words-${currentUser.id}` : 'wordwell-words';
const save = async () => {
  localStorage.setItem(localKey(), JSON.stringify(words));
  if (!supabase || !currentUser) return;
  const rows = words.map(word => ({
    id: word.id,
    user_id: currentUser.id,
    term: word.term,
    definition: word.definition,
    note: word.note || '',
    level: word.level || 0,
    next_review: word.nextReview || Date.now(),
  }));
  const { error } = await supabase.from('user_words').upsert(rows);
  if (error) console.error('[wordwell] Could not sync words:', error.message);
};
const escape = (value = '') => value.replace(/[&<>'"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[c]));
const dueWords = () => words.filter(w => !w.nextReview || w.nextReview <= Date.now()).slice(0, 3);
const greeting = () => new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 18 ? 'Good afternoon' : 'Good evening';

function nav() {
  return `<nav class="bottom-nav">
    ${[['home','⌂','Today'],['words','☷','My words'],['add','＋','Add word']].map(([id,icon,label]) => `<button class="nav-item ${activeTab===id?'active':''}" data-tab="${id}"><span>${icon}</span>${label}</button>`).join('')}
  </nav>`;
}

function render() {
  if (supabaseConfigured && !currentUser) {
    app.innerHTML = authView();
    bindEvents();
    return;
  }
  const views = { home: homeView, words: wordsView, add: addView, review: reviewView };
  app.innerHTML = `<main>${views[activeTab]()}</main>${activeTab !== 'review' ? nav() : ''}<div class="toast" id="toast"></div>`;
  bindEvents();
}

function authView() {
  const isLogin = authMode === 'login';
  return `<main><section class="page auth-page">
    <div class="auth-mark">W</div><p class="eyebrow">YOUR VOCABULARY GARDEN</p>
    <h1>${isLogin ? 'Welcome back.' : 'Plant your account.'}</h1>
    <p class="auth-lede">${isLogin ? 'Sign in to keep growing your words.' : 'Create an account and take your words anywhere.'}</p>
    <form id="auth-form" class="word-form">
      <label>EMAIL<input name="email" type="email" autocomplete="email" required placeholder="you@example.com" /></label>
      <label>PASSWORD<input name="password" type="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" minlength="6" required placeholder="At least 6 characters" /></label>
      <button class="primary wide" type="submit">${isLogin ? 'Sign in  →' : 'Create account  →'}</button>
    </form>
    ${authMessage ? `<p class="auth-message">${escape(authMessage)}</p>` : ''}
    <button class="text-button" id="toggle-auth">${isLogin ? 'New here? Create an account' : 'Already have an account? Sign in'}</button>
  </section></main>`;
}

function homeView() {
  const due = dueWords();
  const learned = words.filter(w => w.level >= 2).length;
  return `<section class="page home">
    <header class="topline"><div class="brand"><i>W</i> wordwell</div><button class="avatar" id="sign-out" aria-label="Sign out">${escape((currentUser?.email || 'S')[0].toUpperCase())}</button></header>
    <div class="intro"><p class="eyebrow">${greeting()}, Shridhik</p><h1>Make every word<br><em>yours.</em></h1></div>
    <section class="review-card">
      <div class="sun">✦</div><p class="eyebrow">TODAY'S PRACTICE</p>
      <h2>${due.length ? `${due.length} word${due.length===1?'':'s'} ready to grow` : 'You’re all caught up!'}</h2>
      <p>${due.length ? 'A few thoughtful minutes is all it takes.' : 'Come back tomorrow for your next gentle review.'}</p>
      <button class="primary wide" id="start-review" ${due.length ? '' : 'disabled'}>${due.length ? 'Start practice  →' : 'Nicely done'}</button>
    </section>
    <div class="section-heading"><h3>Your garden</h3><span>${words.length} words</span></div>
    <section class="stats">
      <div><strong>${learned}</strong><span>learned</span></div><div><strong>${Math.max(words.length-learned, 0)}</strong><span>growing</span></div><div><strong>${due.length}</strong><span>today</span></div>
    </section>
    <section class="word-of-day"><div class="leaf">✿</div><div><p class="eyebrow">A LITTLE REMINDER</p><h3>Small reviews make<br>lasting memories.</h3></div></section>
  </section>`;
}

function wordsView() {
  return `<section class="page words-page">
    <header class="simple-head"><div><p class="eyebrow">YOUR COLLECTION</p><h1>My words</h1></div><button class="round-add" data-tab="add">＋</button></header>
    <label class="search"><span>⌕</span><input id="search" placeholder="Search your words" /></label>
    <div class="word-list" id="word-list">${wordRows(words)}</div>
  </section>`;
}

function wordRows(items) {
  if (!items.length) return `<div class="empty"><div>✦</div><h3>No matches yet</h3><p>Add a new word to begin your collection.</p></div>`;
  return items.sort((a,b)=>a.term.localeCompare(b.term)).map(w => `<article class="word-row" data-word="${w.id}"><div class="word-marker level-${w.level}">${w.level >= 2 ? '✓' : '•'}</div><div><h3>${escape(w.term)}</h3><p>${escape(w.definition)}</p></div><span>›</span></article>`).join('');
}

function addView() {
  return `<section class="page add-page"><header class="simple-head"><div><p class="eyebrow">GROW YOUR COLLECTION</p><h1>Add a word</h1></div></header>
    <form id="add-form" class="word-form">
      <label>THE WORD<input name="term" autocomplete="off" required placeholder="e.g. effervescent" /></label>
      <label>WHAT IT MEANS<textarea name="definition" required placeholder="Write it in your own words — that’s how it sticks."></textarea></label>
      <label>OPTIONAL NOTE<textarea name="note" placeholder="Where did you find it? What does it remind you of?"></textarea></label>
      <button class="primary wide" type="submit">Plant this word  →</button>
    </form>
    <p class="form-tip"><span>✦</span> Your own definition helps build a stronger memory.</p>
  </section>`;
}

function reviewView() {
  const word = reviewQueue[reviewIndex];
  if (!word) return reviewDone();
  const progress = ((reviewIndex / reviewQueue.length) * 100).toFixed(0);
  return `<section class="page review-page"><header class="review-head"><button id="close-review">×</button><div class="progress"><i style="width:${progress}%"></i></div><span>${reviewIndex+1} / ${reviewQueue.length}</span></header>
    <div class="review-content"><p class="eyebrow">${reviewIndex % 2 ? 'MEANING CHECK' : 'SENTENCE CHALLENGE'}</p>
      <h1>${reviewIndex % 2 ? 'What does this word mean?' : `Use “${escape(word.term)}” in a sentence.`}</h1>
      <article class="review-word"><span>WORD</span><h2>${escape(word.term)}</h2></article>
      ${reviewIndex % 2 ? `<div class="meaning-area ${meaningRevealed?'revealed':''}">${meaningRevealed ? `<p>${escape(word.definition)}</p><small>How familiar did this feel?</small><div class="grade-row"><button data-grade="again">Again</button><button data-grade="good">Good</button><button data-grade="easy">Easy</button></div>` : `<button id="reveal-meaning" class="secondary wide">Reveal meaning</button>`}</div>` : `<form id="sentence-form"><textarea id="sentence" required placeholder="Write a sentence that makes the meaning clear..."></textarea><button class="primary wide" type="submit">Check my sentence  →</button></form>`}
    </div></section>`;
}

function reviewDone() { return `<section class="page done"><div class="done-star">✦</div><p class="eyebrow">PRACTICE COMPLETE</p><h1>Beautiful work.</h1><p>You gave your words a little more room to take root today.</p><button id="finish-review" class="primary wide">Back to my garden</button></section>`; }

function bindEvents() {
  document.querySelector('#auth-form')?.addEventListener('submit', submitAuth);
  document.querySelector('#toggle-auth')?.addEventListener('click', () => { authMode = authMode === 'login' ? 'signup' : 'login'; authMessage = ''; render(); });
  document.querySelector('#sign-out')?.addEventListener('click', signOut);
  document.querySelectorAll('[data-tab]').forEach(el => el.onclick = () => { activeTab=el.dataset.tab; render(); });
  document.querySelector('#start-review')?.addEventListener('click', () => { reviewQueue = dueWords(); reviewIndex=0; activeTab='review'; meaningRevealed=false; render(); });
  document.querySelector('#close-review')?.addEventListener('click', () => { activeTab='home'; render(); });
  document.querySelector('#finish-review')?.addEventListener('click', () => { activeTab='home'; render(); });
  document.querySelector('#reveal-meaning')?.addEventListener('click', () => { meaningRevealed=true; render(); });
  document.querySelectorAll('[data-grade]').forEach(btn => btn.onclick = () => finishCard(btn.dataset.grade));
  document.querySelector('#add-form')?.addEventListener('submit', addWord);
  document.querySelector('#sentence-form')?.addEventListener('submit', checkSentence);
  document.querySelector('#search')?.addEventListener('input', e => document.querySelector('#word-list').innerHTML = wordRows(words.filter(w => `${w.term} ${w.definition}`.toLowerCase().includes(e.target.value.toLowerCase()))));
  document.querySelectorAll('[data-word]').forEach(row => row.onclick = () => showWord(row.dataset.word));
}

async function submitAuth(e) {
  e.preventDefault();
  const form = e.target;
  const data = new FormData(form);
  const email = data.get('email').trim();
  const password = data.get('password');
  const button = form.querySelector('button');
  button.disabled = true;
  button.textContent = authMode === 'login' ? 'Signing in…' : 'Creating account…';
  const result = authMode === 'login'
    ? await supabase.auth.signInWithPassword({ email, password })
    : await supabase.auth.signUp({ email, password });
  button.disabled = false;
  if (result.error) { authMessage = result.error.message; render(); return; }
  if (authMode === 'signup' && !result.data.session) {
    authMessage = 'Check your email to confirm your account, then sign in.';
    render();
  }
}

async function signOut() {
  await supabase?.auth.signOut();
  currentUser = null;
  words = [];
  activeTab = 'home';
  render();
}

function normalizeWords(items) {
  return items.map(word => word.id === '2' && word.term.toLowerCase() === 'lucid'
    ? { ...word, definition: 'Clear and easy to understand.' }
    : word);
}

async function addDailyWords() {
  const today = new Date().toISOString().slice(0, 10);
  const markerKey = currentUser ? `wordwell-daily-${currentUser.id}` : 'wordwell-daily';
  const previousDay = localStorage.getItem(markerKey);
  if (!previousDay) { localStorage.setItem(markerKey, today); return; }
  if (previousDay === today) return;

  const dayNumber = Math.floor(Date.now() / 86400000);
  const additions = [];
  for (let offset = 0; additions.length < 3 && offset < dailyWordPool.length; offset += 1) {
    const [term, definition] = dailyWordPool[(dayNumber * 3 + offset) % dailyWordPool.length];
    if (words.some(word => word.term.toLowerCase() === term)) continue;
    additions.push({ id: crypto.randomUUID(), term, definition, note: 'Daily word', level: 0, nextReview: Date.now() });
  }
  words.push(...additions);
  localStorage.setItem(markerKey, today);
  if (additions.length) await save();
}

async function loadWords() {
  const saved = JSON.parse(localStorage.getItem(localKey()) || 'null');
  if (supabase && currentUser) {
    const { data, error } = await supabase.from('user_words').select('id,term,definition,note,level,next_review').order('created_at', { ascending: true });
    if (!error && data?.length) {
      words = data.map(row => ({ id: row.id, term: row.term, definition: row.definition, note: row.note || '', level: row.level || 0, nextReview: row.next_review || Date.now() }));
      localStorage.setItem(localKey(), JSON.stringify(words));
      await addDailyWords();
      return;
    }
    if (error) console.error('[wordwell] Could not load words:', error.message);
  }
  words = normalizeWords(saved || seedWords);
  await save();
  await addDailyWords();
}

async function startApp() {
  if (!supabaseConfigured) {
    words = normalizeWords(JSON.parse(localStorage.getItem('wordwell-words') || 'null') || seedWords);
    localStorage.setItem('wordwell-words', JSON.stringify(words));
    await addDailyWords();
    render();
    return;
  }
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user || null;
  if (currentUser) await loadWords();
  render();
  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    if (currentUser) await loadWords();
    else words = [];
    render();
  });
}

function addWord(e) { e.preventDefault(); const data = new FormData(e.target); const term=data.get('term').trim(); if (words.some(w=>w.term.toLowerCase()===term.toLowerCase())) return showToast('That word is already in your garden.'); words.unshift({id:crypto.randomUUID(), term, definition:data.get('definition').trim(), note:data.get('note').trim(), level:0, nextReview:Date.now()}); save(); activeTab='words'; render(); showToast('New word planted ✦'); }
function finishCard(grade) { const word=reviewQueue[reviewIndex]; const days = grade==='easy'?7:grade==='good'?3:1; word.level = grade==='again'?Math.max(0,word.level-1):Math.min(3,word.level+1); word.nextReview=Date.now()+days*86400000; save(); reviewIndex++; meaningRevealed=false; render(); }
async function checkSentence(e) {
  e.preventDefault();
  const form = document.querySelector('#sentence-form');
  const input = document.querySelector('#sentence');
  const text = input.value.trim();
  const word = reviewQueue[reviewIndex];
  if (!text || !word) return;
  if (!text.toLowerCase().includes(word.term.toLowerCase())) return showToast(`Try including “${word.term}” in your sentence.`);

  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Checking…';
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch('/api/check-sentence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({ term: word.term, definition: word.definition, sentence: text }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'Sentence checking is temporarily unavailable.');

    const isCorrect = result.verdict === 'correct';
    const isUncertain = result.verdict === 'uncertain';
    const headline = isCorrect ? 'That fits the meaning.' : isUncertain ? 'I’m not fully sure yet.' : 'Let’s adjust the meaning.';
    const detail = result.explanation || 'Try checking your sentence against the saved definition.';
    const suggestion = result.suggestedRevision ? `<p class="suggestion"><strong>Try:</strong> ${escape(result.suggestedRevision)}</p>` : '';
    form.innerHTML = `<div class="feedback ${isCorrect ? 'positive' : ''}"><span>${isCorrect ? '✦' : '↗'}</span><h3>${headline}</h3><p>${escape(detail)}</p>${suggestion}<button class="primary wide" id="next-card">${isCorrect ? 'Continue  →' : 'Try again'}</button></div>`;
    document.querySelector('#next-card').onclick = () => isCorrect ? finishCard('good') : render();
  } catch (error) {
    button.disabled = false;
    button.textContent = 'Check my sentence  →';
    showToast(error.name === 'AbortError' ? 'The checker timed out. Please try again.' : error.message || 'Could not check that sentence.');
  } finally {
    clearTimeout(timeout);
  }
}
function showWord(id) { const w=words.find(x=>x.id===id); if(!w) return; activeTab='words'; app.innerHTML=`<main><section class="page detail"><button class="back" data-tab="words">← My words</button><p class="eyebrow">YOUR WORD</p><h1>${escape(w.term)}</h1><div class="definition"><span>YOUR DEFINITION</span><p>${escape(w.definition)}</p></div>${w.note?`<div class="note"><span>NOTE</span><p>${escape(w.note)}</p></div>`:''}<button class="secondary wide" id="practice-one">Practice this word  →</button></section></main>${nav()}<div class="toast" id="toast"></div>`; bindEvents(); document.querySelector('#practice-one').onclick=()=>{reviewQueue=[w];reviewIndex=0;activeTab='review';render();}; }
function showToast(message) { const el=document.querySelector('#toast'); if(!el)return; el.textContent=message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2500); }
startApp();
