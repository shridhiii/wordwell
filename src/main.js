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
  ['candid', 'Truthful and direct, even when it may be uncomfortable.'],
  ['compassionate', 'Showing concern for someone who is suffering.'],
  ['deliberate', 'Done consciously and intentionally.'],
  ['formidable', 'Inspiring fear or respect because of strength or ability.'],
  ['insightful', 'Showing a deep understanding of something.'],
  ['legitimate', 'Conforming to the law or accepted standards.'],
  ['obsolete', 'No longer useful because something newer exists.'],
  ['profound', 'Very great, intense, or meaningful.'],
  ['skeptical', 'Not easily convinced; questioning what is claimed.'],
  ['tactful', 'Careful not to offend or upset others.'],
  ['tenacious', 'Persistent and determined to achieve a goal.'],
  ['unprecedented', 'Never done or known before.'],
  ['whimsical', 'Playfully unusual or imaginative.'],
  ['contemplate', 'To think about something carefully for a while.'],
  ['articulate', 'Able to express ideas clearly and effectively.'],
];

let words = [];
let currentUser = null;
let dailyClaimedToday = false;
let familyProfile = null;
let familyInfo = null;
let familyMembers = [];
let authMode = 'login';
let authMessage = '';
let dailySession = { date: '', picks: [], index: 0, started: false };
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
    ${[['home','⌂','Today'],['words','☷','My words'],['recommend','✦','Discover'],['family','♧','Family'],['add','＋','Add word']].map(([id,icon,label]) => `<button class="nav-item ${activeTab===id?'active':''}" data-tab="${id}"><span>${icon}</span>${label}</button>`).join('')}
  </nav>`;
}

function render() {
  if (supabaseConfigured && !currentUser) {
    app.innerHTML = authView();
    bindEvents();
    return;
  }
  const views = { home: homeView, words: wordsView, recommend: recommendationsView, family: familyView, add: addView, review: reviewView };
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

function dailyMarkerKey() { return currentUser ? `wordwell-daily-${currentUser.id}` : 'wordwell-daily'; }
function todayKey() { return new Date().toISOString().slice(0, 10); }
function dailyRecommendations() {
  const dayNumber = Math.floor(Date.now() / 86400000);
  const picks = [];
  for (let offset = 0; picks.length < 3 && offset < dailyWordPool.length; offset += 1) {
    const [term, definition] = dailyWordPool[(dayNumber * 3 + offset) % dailyWordPool.length];
    if (!words.some(word => word.term.toLowerCase() === term)) picks.push({ term, definition });
  }
  return picks;
}

function getDailySession() {
  const today = todayKey();
  if (dailySession.date !== today) {
    dailySession = { date: today, picks: dailyRecommendations(), index: 0, started: false };
    if (dailyClaimedToday || localStorage.getItem(dailyMarkerKey()) === today) dailySession.index = dailySession.picks.length;
  }
  return dailySession;
}

function recommendationsView() {
  const session = getDailySession();
  const claimed = session.index >= session.picks.length;
  const current = session?.picks[session.index];
  return `<section class="page words-page"><header class="simple-head"><div><p class="eyebrow">YOUR DAILY GROWTH</p><h1>Discover</h1></div><div class="discover-spark">✦</div></header>
    <p class="discover-lede">Three thoughtful words, once a day. Choose the ones you want to plant.</p>
    ${claimed ? `<div class="daily-complete"><span>✦</span><h3>You’ve learned today’s words.</h3><p>Come back tomorrow for three new words.</p></div>` : current ? `<p class="swipe-count">WORD ${session.index + 1} OF ${session.picks.length}</p><div class="swipe-card" id="swipe-card"><div class="swipe-card-mark">✦</div><h2>${escape(current.term)}</h2><p>${escape(current.definition)}</p><small>Swipe either direction to continue learning</small></div><div class="swipe-actions"><button class="swipe-no" data-swipe="left" aria-label="Previous learning card">←</button><button class="swipe-yes" data-swipe="right" aria-label="Next learning card">→</button></div>` : `<div class="daily-complete"><span>✦</span><h3>Your garden is flourishing.</h3><p>We’ll have more recommendations soon.</p></div>`}
  </section>`;
}

function familyView() {
  if (!supabaseConfigured) return `<section class="page words-page"><header class="simple-head"><div><p class="eyebrow">YOUR CIRCLE</p><h1>Family</h1></div></header><div class="daily-complete"><span>♧</span><h3>Connect Supabase to use Family Circle.</h3><p>This feature needs accounts and cloud storage.</p></div></section>`;
  if (!familyProfile) return `<section class="page words-page"><header class="simple-head"><div><p class="eyebrow">YOUR CIRCLE</p><h1>Family</h1></div></header><p class="discover-lede">Choose a username so your friends know who is learning.</p><form id="profile-form" class="word-form"><label>USERNAME<input name="username" required minlength="2" maxlength="24" pattern="[A-Za-z0-9_]+" placeholder="e.g. shridhik" /></label><button class="primary wide" type="submit">Save username  →</button></form></section>`;
  if (!familyInfo) return `<section class="page words-page"><header class="simple-head"><div><p class="eyebrow">YOUR CIRCLE</p><h1>Family</h1></div></header><p class="discover-lede">Welcome, ${escape(familyProfile.username)}. Create a private circle or join one with an invite code.</p><form id="create-family-form" class="word-form"><label>CREATE A CIRCLE<input name="name" required maxlength="40" placeholder="The Wordwell family" /></label><button class="primary wide" type="submit">Create circle  →</button></form><div class="family-divider">or join an existing circle</div><form id="join-family-form" class="word-form"><label>INVITE CODE<input name="code" required maxlength="16" placeholder="WW-ABC123" /></label><button class="secondary wide" type="submit">Join circle</button></form></section>`;
  const today = new Date().toISOString().slice(0, 10);
  return `<section class="page words-page"><header class="simple-head"><div><p class="eyebrow">YOUR CIRCLE</p><h1>${escape(familyInfo.name)}</h1></div><div class="discover-spark">♧</div></header><div class="invite-box"><span>INVITE CODE</span><strong>${escape(familyInfo.invite_code)}</strong><small>Share this code with family and friends.</small></div><div class="section-heading"><h3>Learning together</h3><span>${familyMembers.length} member${familyMembers.length === 1 ? '' : 's'}</span></div><div class="family-list">${familyMembers.map(member => `<article class="family-row"><div class="word-marker level-2">${escape(member.username[0].toUpperCase())}</div><div><h3>${escape(member.username)}${member.user_id === currentUser?.id ? ' (you)' : ''}</h3><p>${member.today} today · ${member.total} total</p></div><strong>${member.today}</strong></article>`).join('')}</div></section>`;
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
  document.querySelector('#claim-daily')?.addEventListener('click', claimDailyWords);
  document.querySelector('#profile-form')?.addEventListener('submit', saveProfile);
  document.querySelector('#create-family-form')?.addEventListener('submit', createFamily);
  document.querySelector('#join-family-form')?.addEventListener('submit', joinFamily);
  document.querySelectorAll('[data-swipe]').forEach(button => button.addEventListener('click', advanceDailyCard));
  bindSwipeCard();
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
    : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
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
  dailyClaimedToday = false;
  familyProfile = null;
  familyInfo = null;
  familyMembers = [];
  activeTab = 'home';
  render();
}

async function saveProfile(event) {
  event.preventDefault();
  const username = new FormData(event.target).get('username').trim();
  const { error } = await supabase.from('profiles').upsert({ user_id: currentUser.id, username });
  if (error) {
    console.error('[wordwell] Could not save username:', error.message, error.code);
    if (error.code === '42P01') return showToast('Family tables are not set up yet. Run the Supabase schema.');
    return showToast(error.code === '23505' ? 'That username is already taken.' : `Could not save username: ${error.message}`);
  }
  await loadFamily();
  render();
}

function makeInviteCode() { return `WW-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; }

async function createFamily(event) {
  event.preventDefault();
  const name = new FormData(event.target).get('name').trim();
  const family = { id: crypto.randomUUID(), name, invite_code: makeInviteCode(), created_by: currentUser.id };
  const { error: familyError } = await supabase.from('families').insert(family);
  if (familyError) return showToast('Could not create circle.');
  const { error: memberError } = await supabase.from('family_members').insert({ family_id: family.id, user_id: currentUser.id });
  if (memberError) return showToast('Circle created, but membership could not be saved.');
  await loadFamily();
  render();
}

async function joinFamily(event) {
  event.preventDefault();
  const code = new FormData(event.target).get('code').trim().toUpperCase();
  const { data: family, error } = await supabase.from('families').select('id').eq('invite_code', code).maybeSingle();
  if (error || !family) return showToast('That invite code was not found.');
  const { error: joinError } = await supabase.from('family_members').insert({ family_id: family.id, user_id: currentUser.id });
  if (joinError && joinError.code !== '23505') return showToast('Could not join that circle.');
  await loadFamily();
  render();
}

async function loadFamily() {
  if (!supabase || !currentUser) return;
  const { data: profile } = await supabase.from('profiles').select('user_id,username').eq('user_id', currentUser.id).maybeSingle();
  familyProfile = profile || null;
  familyInfo = null;
  familyMembers = [];
  if (!familyProfile) return;
  const { data: memberships } = await supabase.from('family_members').select('family_id').eq('user_id', currentUser.id);
  const familyIds = (memberships || []).map(row => row.family_id);
  if (!familyIds.length) return;
  const { data: families } = await supabase.from('families').select('id,name,invite_code').in('id', familyIds).limit(1);
  familyInfo = families?.[0] || null;
  if (!familyInfo) return;
  const { data: members } = await supabase.from('family_members').select('user_id').eq('family_id', familyInfo.id);
  const memberIds = (members || []).map(row => row.user_id);
  const { data: profiles } = await supabase.from('profiles').select('user_id,username').in('user_id', memberIds);
  const { data: completions } = await supabase.from('completed_words').select('user_id,completed_at').in('user_id', memberIds);
  const today = new Date().toISOString().slice(0, 10);
  familyMembers = (profiles || []).map(profileRow => {
    const mine = (completions || []).filter(row => row.user_id === profileRow.user_id);
    return { ...profileRow, total: mine.length, today: mine.filter(row => row.completed_at.slice(0, 10) === today).length };
  }).sort((a, b) => b.today - a.today || b.total - a.total);
}

async function recordCompletion(wordId) {
  if (!supabase || !currentUser) return;
  const { error } = await supabase.from('completed_words').insert({ id: crypto.randomUUID(), user_id: currentUser.id, word_id: String(wordId) });
  if (error && error.code !== '23505') console.error('[wordwell] Could not record completion:', error.message);
}

async function claimDailyWords() {
  if (dailyClaimedToday) return showToast('Today’s three words are already planted.');
  const picks = dailyRecommendations();
  if (!picks.length) return showToast('No new words are available today.');
  if (supabase && currentUser) {
    const { error } = await supabase.from('daily_claims').insert({ user_id: currentUser.id, day: todayKey() });
    if (error) { dailyClaimedToday = true; render(); return showToast('Today’s words are already planted.'); }
  }
  words.push(...picks.map(({ term, definition }) => ({ id: crypto.randomUUID(), term, definition, note: 'Daily recommendation', level: 0, nextReview: Date.now() })));
  localStorage.setItem(dailyMarkerKey(), todayKey());
  dailyClaimedToday = true;
  await save();
  activeTab = 'words';
  render();
  showToast('Three new words planted ✦');
}

function bindSwipeCard() {
  const card = document.querySelector('#swipe-card');
  if (!card) return;
  let startX = 0;
  card.addEventListener('pointerdown', event => { startX = event.clientX; card.setPointerCapture(event.pointerId); });
  card.addEventListener('pointerup', event => {
    const distance = event.clientX - startX;
    if (Math.abs(distance) >= 70) advanceDailyCard();
  });
}

async function advanceDailyCard() {
  const session = getDailySession();
  const picked = session.picks[session.index];
  if (!picked) return;

  if (!session.started) {
    if (supabase && currentUser) {
      const { error } = await supabase.from('daily_claims').insert({ user_id: currentUser.id, day: todayKey() });
      if (error?.code === '23505') { dailyClaimedToday = true; session.index = session.picks.length; render(); return; }
      if (error) { console.error('[wordwell] Could not save daily claim:', error.message); return showToast('Could not start today’s lesson.'); }
    }
    words.push(...session.picks.map(({ term, definition }) => ({ id: crypto.randomUUID(), term, definition, note: 'Daily lesson', level: 0, nextReview: Date.now() })));
    localStorage.setItem(dailyMarkerKey(), todayKey());
    dailyClaimedToday = true;
    session.started = true;
    await save();
  }
  session.index += 1;
  await recordCompletion(picked.term);
  render();
  if (session.index >= session.picks.length) showToast('Daily lesson complete ✦');
}

function normalizeWords(items) {
  return items.map(word => word.id === '2' && word.term.toLowerCase() === 'lucid'
    ? { ...word, definition: 'Clear and easy to understand.' }
    : word);
}

async function loadWords() {
  const saved = JSON.parse(localStorage.getItem(localKey()) || 'null');
  if (supabase && currentUser) {
    const { data: claim } = await supabase.from('daily_claims').select('day').eq('day', todayKey()).maybeSingle();
    dailyClaimedToday = Boolean(claim);
    const { data, error } = await supabase.from('user_words').select('id,term,definition,note,level,next_review').order('created_at', { ascending: true });
    if (!error && data?.length) {
      words = data.map(row => ({ id: row.id, term: row.term, definition: row.definition, note: row.note || '', level: row.level || 0, nextReview: row.next_review || Date.now() }));
      localStorage.setItem(localKey(), JSON.stringify(words));
      return;
    }
    if (error) console.error('[wordwell] Could not load words:', error.message);
  }
  words = normalizeWords(saved || (supabaseConfigured ? [] : seedWords));
  dailyClaimedToday = localStorage.getItem(dailyMarkerKey()) === todayKey();
  if (words.length) await save();
}

async function startApp() {
  if (!supabaseConfigured) {
    words = normalizeWords(JSON.parse(localStorage.getItem('wordwell-words') || 'null') || seedWords);
    localStorage.setItem('wordwell-words', JSON.stringify(words));
    dailyClaimedToday = localStorage.getItem(dailyMarkerKey()) === todayKey();
    render();
    return;
  }
  const { data } = await supabase.auth.getSession();
  currentUser = data.session?.user || null;
  if (currentUser) { await loadWords(); await loadFamily(); }
  render();
  supabase.auth.onAuthStateChange(async (_event, session) => {
    currentUser = session?.user || null;
    if (currentUser) { await loadWords(); await loadFamily(); }
    else { words = []; dailyClaimedToday = false; }
    render();
  });
}

function addWord(e) { e.preventDefault(); const data = new FormData(e.target); const term=data.get('term').trim(); if (words.some(w=>w.term.toLowerCase()===term.toLowerCase())) return showToast('That word is already in your garden.'); words.unshift({id:crypto.randomUUID(), term, definition:data.get('definition').trim(), note:data.get('note').trim(), level:0, nextReview:Date.now()}); save(); activeTab='words'; render(); showToast('New word planted ✦'); }
function finishCard(grade) { const word=reviewQueue[reviewIndex]; const days = grade==='easy'?7:grade==='good'?3:1; word.level = grade==='again'?Math.max(0,word.level-1):Math.min(3,word.level+1); word.nextReview=Date.now()+days*86400000; save(); recordCompletion(word.id); reviewIndex++; meaningRevealed=false; render(); }
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
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(error => console.warn('[wordwell] PWA setup unavailable:', error.message)));
}
startApp();
