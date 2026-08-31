import { requireSession } from '../lib/auth.js';
import { currentCouple, currentUser } from '../lib/db.js';
import { supabase } from '../lib/supabase.js';
import { toast } from '../lib/ui.js';

const session = await requireSession();
const user    = await currentUser();
const uid     = user.id;

const knowMeQs = [
  "What is my favourite movie?","What food could I eat every day?",
  "What's my biggest fear?","What makes me laugh most?",
  "Where do I most want to travel?","What's my love language?",
  "What's my most embarrassing memory?","What do I find most attractive in a person?",
  "What's my dream job?","What song describes me best?"
];

const thisOrThat = [
  ["Morning person","Night owl"],["Beach","Mountains"],["Coffee","Tea"],
  ["Text","Call"],["Stay in","Go out"],["Dogs","Cats"],
  ["Summer","Winter"],["City","Countryside"],["Netflix","Cinema"],["Cook at home","Eat out"]
];

const truthOrDare = {
  truths:[
    "What's the most romantic thing you've ever done?",
    "What's one thing you've never told me?",
    "What first attracted you to me?",
    "What's your biggest relationship deal-breaker?",
    "What's the best date we've ever been on?",
    "What's one thing you want us to do together that we haven't yet?",
    "What's your favourite memory of us?",
    "When did you realise you had feelings for me?"
  ],
  dares:[
    "Send me a voice note saying something you love about me.",
    "Write me a 3-sentence love letter right now.",
    "Tell me your favourite thing about my personality.",
    "Describe our perfect day together.",
    "Say something cheesy and romantic without laughing.",
    "Name 5 things you love about me in 30 seconds."
  ]
};

const questions36 = [
  "Given the choice of anyone in the world, who would you want as a dinner guest?",
  "Would you like to be famous? In what way?",
  "Before making a telephone call, do you ever rehearse what you're going to say?",
  "What would constitute a perfect day for you?",
  "When did you last sing to yourself? To someone else?",
  "If you were able to live to 90 and retain the mind or body of a 30-year-old, which would you want?",
  "Name three things you and your partner appear to have in common.",
  "What are you most grateful for in your life?",
  "If you could change anything about the way you were raised, what would it be?",
  "What is your most treasured memory?"
];

const loveLangQuiz = [
  { q:"When you feel down, what helps most?",
    opts:["Kind words from my partner","A hug or physical closeness","My partner doing something helpful","Spending quality time together","A thoughtful gift"],
    lang:["words","touch","acts","time","gifts"] },
  { q:"How do you most like to show love?",
    opts:["Saying 'I love you' often","Holding hands or hugging","Helping with tasks","Being fully present","Surprising with gifts"],
    lang:["words","touch","acts","time","gifts"] },
  { q:"What makes you feel most appreciated?",
    opts:["Compliments and praise","Affectionate gestures","My partner anticipating my needs","Uninterrupted one-on-one time","Receiving something meaningful"],
    lang:["words","touch","acts","time","gifts"] }
];

const langNames = {
  words:"Words of Affirmation",touch:"Physical Touch",
  acts:"Acts of Service",time:"Quality Time",gifts:"Gift Giving"
};

// ── Game container ─────────────────────────────────────────────────────────────
const container = document.querySelector('#gameContainer');
const gameArea  = document.querySelector('#gameArea');

function showArea(html) {
  gameArea.innerHTML = html;
  gameArea.style.display = 'block';
  gameArea.scrollIntoView({behavior:'smooth'});
}

async function saveAnswer(couple, gameType, questionId, answer) {
  if (!couple) return;
  let { data: sess } = await supabase.from('game_sessions')
    .select('id').eq('couple_id', couple.id).eq('game_type', gameType).eq('status','active').maybeSingle();
  if (!sess) {
    const { data } = await supabase.from('game_sessions')
      .insert({couple_id:couple.id,game_type:gameType,created_by:uid}).select('id').single();
    sess = data;
  }
  if (!sess) return;
  await supabase.from('game_answers').upsert({
    session_id:sess.id, user_id:uid, question_id:questionId, ciphertext:answer
  },{onConflict:'session_id,user_id,question_id'});
}

// ── Know Me ────────────────────────────────────────────────────────────────────
document.querySelector('#startKnowMe').onclick = async () => {
  const couple = await currentCouple();
  const q = knowMeQs[Math.floor(Math.random() * knowMeQs.length)];
  showArea(`
    <div class="panel">
      <p class="eyebrow">HOW WELL DO YOU KNOW ME?</p>
      <h3 style="margin:12px 0 20px">${q}</h3>
      <textarea id="knowMeAnswer" placeholder="Your answer…" rows="3"></textarea>
      <button class="button accent full mt" id="submitKnowMe">Submit answer</button>
      <p id="knowMeStatus" class="status mt"></p>
    </div>`);
  document.querySelector('#submitKnowMe').onclick = async () => {
    const ans = document.querySelector('#knowMeAnswer').value.trim();
    if (!ans) return;
    await saveAnswer(couple, 'know_me', q, ans);
    document.querySelector('#knowMeStatus').textContent = '✓ Answer saved! Ask your partner the same question to compare.';
    toast('Answer saved 💕', 'success');
  };
};

// ── This or That ───────────────────────────────────────────────────────────────
document.querySelector('#startThisOrThat').onclick = async () => {
  const couple = await currentCouple();
  const pair   = thisOrThat[Math.floor(Math.random() * thisOrThat.length)];
  showArea(`
    <div class="panel">
      <p class="eyebrow">THIS OR THAT</p>
      <h3 style="margin:12px 0 20px">Which do you prefer?</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <button class="button light" style="padding:20px;font-size:16px;height:80px" id="choiceA">${pair[0]}</button>
        <button class="button light" style="padding:20px;font-size:16px;height:80px" id="choiceB">${pair[1]}</button>
      </div>
      <p id="totStatus" class="status mt"></p>
    </div>`);
  const choose = async (choice) => {
    await saveAnswer(couple, 'this_or_that', pair.join(' vs '), choice);
    document.querySelector('#totStatus').textContent = `You chose: ${choice} 💕 Ask your partner!`;
    document.querySelectorAll('#choiceA,#choiceB').forEach(b => b.disabled=true);
    document.querySelector(choice===pair[0]?'#choiceA':'#choiceB').className = 'button accent';
    toast(`You chose ${choice}!`, 'success');
  };
  document.querySelector('#choiceA').onclick = () => choose(pair[0]);
  document.querySelector('#choiceB').onclick = () => choose(pair[1]);
};

// ── Truth or Dare ──────────────────────────────────────────────────────────────
document.querySelector('#startTruthOrDare').onclick = async () => {
  const couple = await currentCouple();
  showArea(`
    <div class="panel">
      <p class="eyebrow">TRUTH OR DARE</p>
      <h3 style="margin:12px 0 20px">Choose your challenge</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
        <button class="button accent" style="padding:20px;height:80px;font-size:18px" id="pickTruth">🙊 Truth</button>
        <button class="button dark" style="padding:20px;height:80px;font-size:18px" id="pickDare">🎯 Dare</button>
      </div>
      <div id="todResult" class="mt"></div>
    </div>`);
  document.querySelector('#pickTruth').onclick = () => {
    const q = truthOrDare.truths[Math.floor(Math.random()*truthOrDare.truths.length)];
    document.querySelector('#todResult').innerHTML = `
      <div class="panel" style="background:rgba(124,58,237,.08);border-color:var(--accent)">
        <p class="eyebrow">YOUR TRUTH</p>
        <p style="font-size:18px;font-weight:700;margin-top:8px;color:var(--text)">${q}</p>
        <textarea placeholder="Your answer (private)…" style="margin-top:12px" id="todAns" rows="3"></textarea>
        <button class="button accent full mt" id="saveTod">Save answer</button>
      </div>`;
    document.querySelector('#saveTod').onclick = async () => {
      const ans = document.querySelector('#todAns').value.trim();
      if (!ans) return;
      await saveAnswer(couple, 'truth_or_dare', q, ans);
      toast('Answer saved 💕', 'success');
    };
  };
  document.querySelector('#pickDare').onclick = () => {
    const d = truthOrDare.dares[Math.floor(Math.random()*truthOrDare.dares.length)];
    document.querySelector('#todResult').innerHTML = `
      <div class="panel" style="background:rgba(236,72,153,.08);border-color:var(--accent2)">
        <p class="eyebrow" style="color:var(--accent2)">YOUR DARE</p>
        <p style="font-size:18px;font-weight:700;margin-top:8px;color:var(--text)">${d}</p>
        <button class="button accent full mt" id="doneBtn">Done! ✓</button>
      </div>`;
    document.querySelector('#doneBtn').onclick = () => { toast('Nice! 🔥', 'success'); saveAnswer(couple,'truth_or_dare',d,'completed'); };
  };
};

// ── 36 Questions ──────────────────────────────────────────────────────────────
document.querySelector('#start36Q').onclick = async () => {
  const couple = await currentCouple();
  let idx = 0;
  const show = () => {
    if (idx >= questions36.length) {
      showArea(`<div class="panel center"><h2>💕 Complete!</h2><p>You've answered all 36 questions. These are designed to build closeness — share your answers with your partner.</p></div>`);
      return;
    }
    showArea(`
      <div class="panel">
        <p class="eyebrow">36 QUESTIONS · ${idx+1} of ${questions36.length}</p>
        <div style="background:var(--bg);border-radius:12px;padding:16px;margin:12px 0">
          <p style="font-size:18px;font-weight:700;color:var(--text);line-height:1.5">${questions36[idx]}</p>
        </div>
        <textarea id="q36ans" placeholder="Your answer…" rows="4"></textarea>
        <div style="display:flex;gap:10px;margin-top:12px">
          <button class="button light" id="q36skip">Skip →</button>
          <button class="button accent" style="flex:1" id="q36save">Save & Next →</button>
        </div>
        <div style="background:var(--border);border-radius:99px;height:6px;margin-top:16px">
          <div style="background:linear-gradient(135deg,var(--accent),var(--accent2));height:6px;border-radius:99px;width:${Math.round((idx/questions36.length)*100)}%;transition:width .5s"></div>
        </div>
      </div>`);
    document.querySelector('#q36save').onclick = async () => {
      const ans = document.querySelector('#q36ans').value.trim();
      if (ans) { await saveAnswer(couple, '36_questions', questions36[idx], ans); toast('Saved 💕','success'); }
      idx++; show();
    };
    document.querySelector('#q36skip').onclick = () => { idx++; show(); };
  };
  show();
};

// ── Love Language Quiz ─────────────────────────────────────────────────────────
document.querySelector('#startLoveLang').onclick = async () => {
  const couple = await currentCouple();
  const scores = {words:0,touch:0,acts:0,time:0,gifts:0};
  let qi = 0;
  const showQ = () => {
    if (qi >= loveLangQuiz.length) {
      const top = Object.entries(scores).sort((a,b)=>b[1]-a[1])[0];
      showArea(`
        <div class="panel center">
          <div style="font-size:60px;margin-bottom:16px">💝</div>
          <p class="eyebrow">YOUR LOVE LANGUAGE</p>
          <h2 style="margin:12px 0">${langNames[top[0]]}</h2>
          <p>This is how you feel most loved and appreciated. Share this with your partner!</p>
          <button class="button accent full mt" id="shareLang">Share with partner 💕</button>
        </div>`);
      document.querySelector('#shareLang').onclick = async () => {
        await saveAnswer(couple, 'love_language', 'result', `${langNames[top[0]]} (score: ${top[1]})`);
        toast('Shared with your partner! 💕', 'success');
      };
      return;
    }
    const q = loveLangQuiz[qi];
    showArea(`
      <div class="panel">
        <p class="eyebrow">LOVE LANGUAGE QUIZ · ${qi+1} of ${loveLangQuiz.length}</p>
        <h3 style="margin:16px 0">${q.q}</h3>
        <div style="display:flex;flex-direction:column;gap:10px">
          ${q.opts.map((o,i) => `<button class="button light" style="text-align:left;padding:14px" data-lang="${q.lang[i]}">${o}</button>`).join('')}
        </div>
      </div>`);
    gameArea.querySelectorAll('button[data-lang]').forEach(btn => {
      btn.onclick = () => { scores[btn.dataset.lang]++; qi++; showQ(); };
    });
  };
  showQ();
};

// ── Daily Question ─────────────────────────────────────────────────────────────
document.querySelector('#startDailyQ').onclick = async () => {
  const couple  = await currentCouple();
  const dailyQs = [
    "What made you smile today?","What are you most grateful for right now?",
    "What's one thing you love about our relationship?","What's been on your mind lately?",
    "What's something kind someone did for you recently?","What's a goal you're working towards?",
    "What song is stuck in your head today?"
  ];
  const q = dailyQs[new Date().getDate() % dailyQs.length];
  showArea(`
    <div class="panel">
      <p class="eyebrow">TODAY'S QUESTION</p>
      <div style="background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border-radius:16px;padding:20px;margin:12px 0">
        <p style="font-size:18px;font-weight:700;line-height:1.5">${q}</p>
      </div>
      <textarea id="dailyAns" placeholder="Your answer…" rows="3"></textarea>
      <button class="button accent full mt" id="saveDailyQ">Share with partner 💕</button>
      <p id="dailyStatus" class="status mt"></p>
    </div>`);
  document.querySelector('#saveDailyQ').onclick = async () => {
    const ans = document.querySelector('#dailyAns').value.trim();
    if (!ans) return;
    await saveAnswer(couple, 'daily_question', q, ans);
    document.querySelector('#dailyStatus').textContent = '✓ Shared! Check if your partner has answered too.';
    toast('Answer shared 💕', 'success');
  };
};
