
/* ═══════════════════════════════════════════
   API
═══════════════════════════════════════════ */
async function apiPost(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||'Ошибка');}return r.json();}
async function apiGet(path){const r=await fetch(path);if(!r.ok)throw new Error('Ошибка');return r.json();}
async function apiPut(path,body){const r=await fetch(path,{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||'Ошибка');}return r.json();}
async function apiPatch(path,body={}){const r=await fetch(path,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||'Ошибка');}return r.json();}
async function apiDelete(path){const r=await fetch(path,{method:'DELETE'});if(!r.ok){const e=await r.json().catch(()=>({}));throw new Error(e.detail||'Ошибка');}return r.json();}

/* ═══════════════════════════════════════════
   STATE
═══════════════════════════════════════════ */
let user=null,currentTestDef=null,currentQuestions=[],currentAnswers={},currentQ=0;
let timerRemaining=0,timerInterval=null,testStartTime=0,lastResultId=null;
let currentMode='test',selectedOperation=null,selectedQty=5;
let panelOpen=true;
let launchScreen='main'; // 'main' or 'super' — where to return after test

/* ═══════════════════════════════════════════
   PANEL
═══════════════════════════════════════════ */
function togglePanel(){
  panelOpen=!panelOpen;
  document.getElementById('panel-wrapper').classList.toggle('closed',!panelOpen);
}

/* ═══════════════════════════════════════════
   PAGES
═══════════════════════════════════════════ */
const PAGE_TITLES={tests:'Тесты',typed:'Типовые задания',control:'Контрольная работа',theory:'Теория',history:'История'};
function switchPage(name){
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+name).classList.add('active');
  document.querySelectorAll('.panel-btn').forEach(b=>b.classList.remove('active'));
  const pb=document.getElementById('pb-'+name);if(pb)pb.classList.add('active');
  if(name==='history')loadHistory();
  if(name==='daily')buildDailyPage();
  if(name==='theory')setTimeout(initTheoryScroll,100);
  if(name==='control'){ _customCtrlsCacheInvalidate(); buildStudentCtrlPage(); }
}

async function buildStudentCtrlPage(){
  const container = document.getElementById('ctrl-student-card');
  if(!container) return;
  const allCtrls = await loadCustomCtrls();
  const ctrls = allCtrls.filter(c => c.active && (!c.grade || c.grade === String(userGrade())));

  const gradeScale = `<div style="background:var(--g100);border:2px solid var(--g200);border-radius:var(--r);padding:10px 16px;margin-bottom:16px;font-size:13px;line-height:1.9">
    <b>Шкала оценок:</b>&nbsp;
    <span style="color:#22c55e;font-weight:700">5</span> — от 80%&nbsp;&nbsp;
    <span style="color:#84cc16;font-weight:700">4</span> — от 60%&nbsp;&nbsp;
    <span style="color:#f59e0b;font-weight:700">3</span> — от 40%&nbsp;&nbsp;
    <span style="color:#ef4444;font-weight:700">2</span> — ниже 40%
  </div>`;

  if(!ctrls.length){
    container.innerHTML = `<div style="text-align:center;padding:48px 20px;color:var(--g400);font-size:15px;">
      📋 Контрольных работ пока нет<br><span style="font-size:13px">Преподаватель ещё не добавил контрольные</span>
    </div>`;
    return;
  }

  container.innerHTML = ctrls.map((c) => {
    const topicNames = (c.topicKeys||[]).map(k=>{const ti=ALL_TOPIC_INFO.find(x=>x.key===k);return ti?ti.icon+' '+ti.title:k;}).join(' · ');
    const realIdx = allCtrls.findIndex(x => x.id === c.id);
    return `<div class="test-card" style="margin-bottom:16px;">
      <div class="test-card-title">${escHtml(c.title)}</div>
      ${c.desc ? `<div class="test-card-desc">${escHtml(c.desc)}</div>` : ''}
      <div class="test-card-meta">
        <span class="badge badge-ctrl">Контрольная</span>
        <span class="meta-item">📝 ${c.qcount} вопросов</span>
        <span class="meta-item">🕐 ${c.time} мин</span>
        <span class="meta-item">⭐ Оценка 2–5</span>
      </div>
      <div style="background:var(--g100);border:2px solid var(--g200);border-radius:var(--r);padding:10px 16px;margin-bottom:14px;font-size:13px;line-height:1.8">
        <b>Темы:</b> ${escHtml(topicNames||'—')}
      </div>
      ${gradeScale}
      <button class="btn-start" onclick="startCustomCtrlWork(${realIdx})">Начать контрольную работу</button>
    </div>`;
  }).join('');
}

/* ═══════════════════════════════════════════
   THEORY TOC
═══════════════════════════════════════════ */
function scrollToSection(id, linkEl){
  const el=document.getElementById(id);
  if(!el)return;
  const body=document.getElementById('theory-body');
  const bodyRect=body.getBoundingClientRect();
  const elRect=el.getBoundingClientRect();
  body.scrollBy({top:elRect.top - bodyRect.top - 20, behavior:'smooth'});
  document.querySelectorAll('.toc-link').forEach(l=>l.classList.remove('active'));
  if(linkEl)linkEl.classList.add('active');
}

function initTheoryScroll(){
  const body=document.getElementById('theory-body');
  if(!body)return;
  const sections=body.querySelectorAll('.theory-section');
  const links=document.querySelectorAll('.toc-link');
  body.addEventListener('scroll',()=>{
    let current='';
    sections.forEach(s=>{
      if(s.offsetTop - body.scrollTop <= 40) current=s.id;
    });
    links.forEach(l=>{
      l.classList.remove('active');
      if(l.getAttribute('onclick')&&l.getAttribute('onclick').includes("'"+current+"'"))
        l.classList.add('active');
    });
  });
}

/* ═══════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════ */
function showScreen(id){document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));document.getElementById('screen-'+id).classList.add('active');if(typeof mascotScreenState==='function')mascotScreenState(id);}
function showToast(msg,dur=2500){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),dur);}
function escHtml(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

/* ── MATRIX VISUALIZER ── */
function renderMatrix(m, blankPos=null, highlightPos=null){
  // m = 2D array, blankPos = [r,c] to show '?', highlightPos = [r,c] to highlight
  const rows=m.length, cols=m[0].length;
  let cells='';
  for(let r=0;r<rows;r++) for(let c=0;c<cols;c++){
    const isBlank  = blankPos      && blankPos[0]===r      && blankPos[1]===c;
    const isHi     = highlightPos  && highlightPos[0]===r  && highlightPos[1]===c;
    const cls = isBlank?'mat-cell blank':isHi?'mat-cell highlight':'mat-cell';
    cells += `<div class="${cls}">${isBlank?'?':escHtml(String(m[r][c]))}</div>`;
  }
  return `<div class="mat-wrap">
    <div class="mat-bracket">[</div>
    <div class="mat-grid" style="grid-template-columns:repeat(${cols},auto)">${cells}</div>
    <div class="mat-bracket">]</div>
  </div>`;
}

function matFromStr(s){
  // parse "[[1,2],[3,4]]" back to array
  try{ return JSON.parse(s.replace(/\[/g,'[').replace(/\]/g,']')); }catch(e){return null;}
}

function renderQText(q){
  const badge = `<div class="q-type-badge ${q.qtype||'mcq'}">${
    q.qtype==='fill'?'✏️ Заполни пропуск':q.qtype==='tf'?'✅ Верно или неверно':'📋 Выбери ответ'
  }</div>`;

  // Parse a line that may contain "Label = [[...]], Label2 = [[...]]"
  // Returns HTML with labels as text and matrices rendered visually, side by side
  function parseLine(line){
    // Find all matrix occurrences with optional label
    // Pattern: optional "Label = " then "[[...]]"
    const matRe = /([A-Za-zА-Яа-яёЁ\d\s·\^Tᵀ⁻¹]*?=\s*)?(\[\[[\d\s,.\-]+\](?:,\s*\[[\d\s,.\-]+\])*\])/g;
    let result = '';
    let lastIdx = 0;
    let match;
    let hasMatrix = false;
    // Collect all matrix blocks and surrounding text
    const parts = [];
    const re2 = /((?:[A-Za-zА-Яа-яёЁ·\^Tᵀ⁻¹\d]+\s*=\s*)?)(\[(?:\[[\d\s,.\-]+\](?:,\s*)?)+\])/g;
    let m2;
    let lastEnd = 0;
    while((m2 = re2.exec(line)) !== null){
      hasMatrix = true;
      const before = line.slice(lastEnd, m2.index);
      if(before.trim()) parts.push({type:'text', val: before.trim()});
      const label = m2[1].trim();
      const matStr2 = m2[2];
      const mat = matFromStr(matStr2);
      if(mat && Array.isArray(mat[0])){
        parts.push({type:'matrix', label, mat});
      } else {
        parts.push({type:'text', val: m2[0]});
      }
      lastEnd = m2.index + m2[0].length;
    }
    const tail = line.slice(lastEnd).trim();
    if(tail) parts.push({type:'text', val: tail});

    if(!hasMatrix) return `<div class="q-matrix-display mono">${escHtml(line)}</div>`;

    // Render parts — text labels + matrices — in a flex row that wraps
    let html2 = '<div class="mat-row">';
    for(const p of parts){
      if(p.type==='text'){
        html2 += `<span class="mat-row-label">${escHtml(p.val)}</span>`;
      } else {
        let lbl = p.label ? `<span class="mat-row-label">${escHtml(p.label)}</span>` : '';
        html2 += `<div class="mat-row-item">${lbl}${renderMatrix(p.mat)}</div>`;
      }
    }
    html2 += '</div>';
    return html2;
  }

  const lines = q.text.split('\n');
  let html = badge;
  html += `<div class="q-question-text">${escHtml(lines[0])}</div>`;

  for(let i=1;i<lines.length;i++){
    const line = lines[i].trim();
    if(!line) continue;
    html += parseLine(line);
  }

  // Extra matrices from q.matrices (fill/tf generators)
  if(q.matrices){
    html += '<div class="mat-row">';
    for(const [label, mat, bp, hp] of q.matrices){
      html += `<div class="mat-row-item">
        <span class="mat-row-label">${escHtml(label)}</span>
        ${renderMatrix(mat, bp||null, hp||null)}
      </div>`;
    }
    html += '</div>';
  }
  return html;
}

/* ═══════════════════════════════════════════
   TESTS DATA
═══════════════════════════════════════════ */
const TESTS=[
  {id:1, title:'Тест 1 — Базовый',      desc:'Сложение матриц и умножение на скаляр',                          difficulty:'easy',   diffLabel:'Лёгкий',  questions:5, time:15, topics:['add','scalar','equal','add','scalar']},
  {id:2, title:'Тест 2 — Размер и транспонирование', desc:'Определение размера матрицы и транспонирование',   difficulty:'easy',   diffLabel:'Лёгкий',  questions:5, time:12, topics:['size','transpose_check','size','transpose','transpose_check']},
  {id:3, title:'Тест 3 — Определители', desc:'Вычисление определителей 2×2',                                  difficulty:'medium', diffLabel:'Средний', questions:5, time:10, topics:['det2','det2','det2','multiply_scalar','det2']},
  {id:4, title:'Тест 4 — Умножение',    desc:'Умножение матриц и скаляра',                                     difficulty:'medium', diffLabel:'Средний', questions:6, time:10, topics:['multiply','multiply','det2','multiply_scalar','add','multiply']},
  {id:5, title:'Тест 5 — Продвинутый',  desc:'Определители 3×3, обратная матрица, ранг',                       difficulty:'hard',   diffLabel:'Сложный', questions:5, time:12, topics:['det3','inverse','det3','rank','det2']},
  {id:6, title:'Тест 6 — Комплексный',  desc:'Все операции: транспонирование, умножение, определители, ранг',  difficulty:'hard',   diffLabel:'Сложный', questions:7, time:15, topics:['det3','multiply','inverse','rank','transpose','det2','det3']},
];
const TYPED_OPS=[
  {key:'add',      icon:'➕', title:'Сложение матриц',              desc:'A + B',                 minGrade:9},
  {key:'multiply', icon:'✖️',  title:'Умножение матриц',              desc:'A · B',                 minGrade:9},
  {key:'transpose',icon:'↗️',  title:'Транспонирование',              desc:'Aᵀ',                    minGrade:9},
  {key:'scalar',   icon:'🔣', title:'Умножение на скаляр',           desc:'k · A',                 minGrade:9},
  {key:'size',     icon:'📏', title:'Определение размера',           desc:'m×n',                   minGrade:9},
  {key:'det',      icon:'🔢', title:'Определитель',                  desc:'det(A) 2×2 и 3×3',     minGrade:9},
  {key:'matpow',   icon:'⬆️', title:'Возведение матрицы в степень',  desc:'Aⁿ для квадратных',     minGrade:9},
  {key:'inverse',  icon:'🔄', title:'Обратная матрица',               desc:'A⁻¹',                   minGrade:10},
  {key:'rank',     icon:'📐', title:'Ранг матрицы',                   desc:'rang(A)',               minGrade:10},
  {key:'sle',      icon:'⚖️',  title:'Системы уравнений',             desc:'Метод Крамера / Гаусса',minGrade:10},
  {key:'minor',    icon:'🔍', title:'Минор и алг. дополнение',       desc:'M_ij и A_ij',           minGrade:11},
];
const ALL_TOPICS=['add','multiply','transpose','scalar','size','det2','det3','inverse','rank','sle'];

// Topics available per grade
const GRADE_TOPICS = {
  9:  ['add','scalar','transpose','size','det','det2','multiply','matpow'],
  10: ['add','scalar','transpose','size','det','det2','det3','multiply','matpow','inverse','rank','sle'],
  11: ['add','scalar','transpose','size','det','det2','det3','multiply','matpow','inverse','rank','sle','minor'],
};
// Topics locked per grade (for typed panel — show but locked)
const LOCKED_TOPICS = {
  9:  ['inverse','rank','sle','minor'],
  10: ['minor'],
  11: [],
};
function userGrade(){ return parseInt(user?.cls) || 9; }
function isTopicLocked(key){ return (LOCKED_TOPICS[userGrade()]||[]).includes(key); }
function isTopicAvailable(key){ return (GRADE_TOPICS[userGrade()]||GRADE_TOPICS[9]).includes(key); }

/* ═══════════════════════════════════════════
   MATH HELPERS
═══════════════════════════════════════════ */
const rI=(a,b)=>Math.floor(Math.random()*(b-a+1))+a;
const rM=(r,c,a=-5,b=9)=>Array.from({length:r},()=>Array.from({length:c},()=>rI(a,b)));
const mS=m=>'['+m.map(r=>'['+r.join(', ')+']').join(', ')+']';
const mAdd=(A,B)=>A.map((r,i)=>r.map((v,j)=>v+B[i][j]));
const mScale=(A,k)=>A.map(r=>r.map(v=>v*k));
const mT=A=>A[0].map((_,j)=>A.map((_,i)=>A[i][j]));
const mMul=(A,B)=>{const R=A.length,C=B[0].length,K=B.length;return Array.from({length:R},(_,i)=>Array.from({length:C},(_,j)=>Array.from({length:K},(_,k)=>A[i][k]*B[k][j]).reduce((a,b)=>a+b,0)));};
const d2=m=>m[0][0]*m[1][1]-m[0][1]*m[1][0];
const d3=m=>m[0][0]*(m[1][1]*m[2][2]-m[1][2]*m[2][1])-m[0][1]*(m[1][0]*m[2][2]-m[1][2]*m[2][0])+m[0][2]*(m[1][0]*m[2][1]-m[1][1]*m[2][0]);
const fmt=n=>{
  if(Number.isInteger(n)) return String(n);
  // Check if it's a clean fraction with small denominator
  for(const d of [2,3,4,5,6,7,8,9,10]){
    const num=Math.round(n*d);
    if(Math.abs(num/d - n) < 0.0001){
      if(d===1) return String(num);
      return num+'/'+d; // show as fraction e.g. 11/3
    }
  }
  // Otherwise round to 2 decimal places
  return (Math.round(n*100)/100).toFixed(2);
};
const mSF=m=>'['+m.map(r=>'['+r.map(v=>{
  if(Number.isInteger(v)) return String(v);
  const r2=Math.round(v*100)/100;
  return r2.toFixed(2);
}).join(', ')+']').join(', ')+']';
function inv2(m){const d=d2(m);if(d===0)return null;return[[m[1][1]/d,-m[0][1]/d],[-m[1][0]/d,m[0][0]/d]];}
function mRank(m){const rows=m.length,cols=m[0].length,a=m.map(r=>[...r]);let rank=0;for(let col=0;col<cols&&rank<rows;col++){let piv=-1;for(let row=rank;row<rows;row++)if(a[row][col]!==0){piv=row;break;}if(piv===-1)continue;[a[rank],a[piv]]=[a[piv],a[rank]];for(let row=0;row<rows;row++)if(row!==rank&&a[row][col]!==0){const f=a[row][col]/a[rank][col];for(let c=0;c<cols;c++)a[row][c]-=f*a[rank][c];}rank++;}return rank;}
function sle2(A,b){const det=d2(A);if(det===0)return null;return[d2([[b[0],A[0][1]],[b[1],A[1][1]]])/det,d2([[A[0][0],b[0]],[A[1][0],b[1]]])/det];}
function shuf(a){const b=[...a];for(let i=b.length-1;i>0;i--){const j=rI(0,i);[b[i],b[j]]=[b[j],b[i]];}return b;}
function makeOpts(correct,gen,n=3){
  const opts=[correct];
  // Use string representation for dedup to catch "2" == "2" etc
  const seen=new Set([String(correct)]);
  let tries=0;
  while(opts.length<n+1&&tries<500){
    const w=gen();
    const key=String(w);
    if(!seen.has(key)){seen.add(key);opts.push(w);}
    tries++;
  }
  return shuf(opts);
}

/* ═══════════════════════════════════════════
   GENERATORS
═══════════════════════════════════════════ */
const G={
  add(){
    const A=rM(2,2,-4,6),B=rM(2,2,-4,6),c=mAdd(A,B);
    const wgen=()=>{
      const w=c.map(r=>[...r]);
      const i=rI(0,1),j=rI(0,1);
      w[i][j]+=rI(1,5)*(Math.random()<0.5?1:-1);
      return mS(w);
    };
    return{text:`Найдите сумму матриц:\nA = ${mS(A)}, B = ${mS(B)}`,options:makeOpts(mS(c),wgen),correct:mS(c)};
  },
  scalar(){
    const A=rM(2,2,-4,6),k=rI(2,5),c=mScale(A,k);
    const wgen=()=>{
      // Wrong scalar: use k+1 or k-1
      const k2=k+(Math.random()<0.5?1:-1);
      return mS(mScale(A,k2));
    };
    return{text:`Умножьте на скаляр k = ${k}:\nA = ${mS(A)}`,options:makeOpts(mS(c),wgen),correct:mS(c)};
  },
  transpose(){const A=rM(2,3,-4,6),c=mT(A);return{text:`Найдите Aᵀ:\nA = ${mS(A)}`,options:makeOpts(mS(c),()=>mS(rM(3,2,-4,6))),correct:mS(c)};},
  transpose_check(){const A=rM(2,2,-4,6),c=mT(A);return{text:`Вычислите Aᵀ:\nA = ${mS(A)}`,options:makeOpts(mS(c),()=>mS(rM(2,2,-4,6))),correct:mS(c)};},
  equal(){const A=rM(2,2,-3,5),B=rM(2,2,-3,5),c=mAdd(A,B);return{text:`Вычислите A + B:\nA = ${mS(A)}, B = ${mS(B)}`,options:makeOpts(mS(c),()=>mS(rM(2,2,-6,10))),correct:mS(c)};},
  size(){
    const r=rI(2,4),c=rI(2,4),A=rM(r,c,-4,6),cor=`${r}×${c}`;
    // Generate wrong sizes that are visually plausible: swap r/c, add 1, subtract 1
    const wrongs=new Set();
    const cands=[`${c}×${r}`,`${r+1}×${c}`,`${r}×${c+1}`,`${r-1>0?r-1:r+2}×${c}`,`${r}×${c-1>0?c-1:c+2}`,'2×2','2×3','3×2','3×3','3×4','4×3'];
    for(const s of cands){if(s!==cor&&!wrongs.has(s))wrongs.add(s);if(wrongs.size>=3)break;}
    return{text:`Определите размер матрицы (строки × столбцы):\nA = ${mS(A)}`,options:shuf([cor,...[...wrongs].slice(0,3)]),correct:cor};
  },
  multiply(){
    const A=rM(2,2,-3,4),B=rM(2,2,-3,4),c=mMul(A,B);
    // Wrong: perturb elements slightly so they look close but are different
    const wgen=()=>{
      const off=rI(1,4);
      const i=rI(0,1),j=rI(0,1);
      const w=c.map(r=>[...r]);
      w[i][j]+=off*(Math.random()<0.5?1:-1);
      const s=mS(w);
      return s===mS(c)?mS(rM(2,2,-12,16)):s;
    };
    return{text:`Найдите A·B:\nA = ${mS(A)}, B = ${mS(B)}`,options:makeOpts(mS(c),wgen),correct:mS(c)};
  },
  multiply_scalar(){const A=rM(2,2,-3,5),k=rI(-3,5),c=mScale(A,k);return{text:`Вычислите ${k}·A:\nA = ${mS(A)}`,options:makeOpts(mS(c),()=>mS(rM(2,2,-15,25))),correct:mS(c)};},
  det2(){
    const m=rM(2,2,-5,7),c=d2(m);
    const w=new Set();
    // Add plausible wrong answers: common mistakes (wrong sign, off-by-one, swapped)
    const mistakes=[
      -c,                          // wrong sign
      m[0][0]*m[1][1]+m[0][1]*m[1][0], // + instead of -
      m[0][0]*m[1][0]-m[0][1]*m[1][1], // wrong diagonal
      c+rI(1,5), c-rI(1,5),       // off by small amount
    ];
    for(const v of mistakes){if(v!==c&&!w.has(v))w.add(v);if(w.size>=3)break;}
    while(w.size<3){const v=rI(-60,60);if(v!==c)w.add(v);}
    return{text:`Определитель 2×2:\n${mS(m)}`,options:shuf([c,...[...w].slice(0,3)]).map(String),correct:String(c)};
  },
  det3(){
    const m=rM(3,3,-4,5),c=d3(m);
    const w=new Set();
    const mistakes=[-c, c+rI(5,20), c-rI(5,20), Math.round(c*1.5)];
    for(const v of mistakes){if(v!==c&&!w.has(v))w.add(v);if(w.size>=3)break;}
    while(w.size<3){const v=rI(-250,250);if(v!==c&&!w.has(v))w.add(v);}
    return{text:`Определитель 3×3:\n${mS(m)}`,options:shuf([c,...[...w].slice(0,3)]).map(String),correct:String(c)};
  },
  det(){return Math.random()<0.5?G.det2():G.det3();},
  inverse(){let m,inv;do{m=rM(2,2,-4,4);inv=inv2(m);}while(!inv);const cor=mSF(inv);const ws=[];while(ws.length<3){let wm;do{wm=rM(2,2,-4,4);}while(d2(wm)===0);const wi=mSF(inv2(wm));if(wi!==cor&&!ws.includes(wi))ws.push(wi);}return{text:`Найдите A⁻¹:\nA = ${mS(m)}`,options:shuf([cor,...ws]),correct:cor};},
  rank(){
    // Use 3x4 matrix for more interesting rank values
    const rows=rI(2,3),cols=rI(3,4),m=rM(rows,cols,-3,4),c=mRank(m);
    // Always offer 4 distinct options from the set {0,1,2,3}
    const pool=[0,1,2,3].filter(v=>v!==c);
    const ws=shuf(pool).slice(0,3);
    return{text:`Определите ранг матрицы:\n${mS(m)}`,options:shuf([String(c),...ws.map(String)]),correct:String(c)};
  },
  sle(){
    let A,b,sol;
    do{A=rM(2,2,-3,3);b=[rI(-5,5),rI(-5,5)];sol=sle2(A,b);}
    while(!sol||Math.abs(sol[0])>10||Math.abs(sol[1])>10);
    let cor=`x₁=${Math.round(sol[0])}, x₂=${Math.round(sol[1])}`;
    const x1=Math.round(sol[0]), x2=Math.round(sol[1]);
    const cor2=`x₁=${x1}, x₂=${x2}`;
    const ws=[];
    const used=new Set([cor2]);
    const cands=[
      `x₁=${x2}, x₂=${x1}`,       // swapped
      `x₁=${-x1}, x₂=${-x2}`,     // negated
      `x₁=${x1+1}, x₂=${x2+1}`,   // off by 1
      `x₁=${x1-1}, x₂=${x2-1}`,
      `x₁=${x1+2}, x₂=${x2-1}`,
    ];
    for(const s of cands){if(!used.has(s)&&ws.length<3){used.add(s);ws.push(s);}}
    while(ws.length<3){const s=`x₁=${rI(-8,8)}, x₂=${rI(-8,8)}`;if(!used.has(s)){used.add(s);ws.push(s);}}
    const method=Math.random()<0.5?'Методом Крамера':'Методом Гаусса';
    return{text:`${method} решите систему:\n${A[0][0]}x₁ + ${A[0][1]}x₂ = ${b[0]}\n${A[1][0]}x₁ + ${A[1][1]}x₂ = ${b[1]}`,options:shuf([cor2,...ws]),correct:cor2};
  },
  scalar_t(){return Math.random()<0.5?G.scalar():G.multiply_scalar();},
  matpow(){
    const A=rM(2,2,-2,3);
    const n=rI(2,3);
    let R=[[1,0],[0,1]];
    for(let i=0;i<n;i++) R=mMul(R,A);
    const cor=mS(R);
    // Wrong answers: slight element changes to look plausible
    const wrongGen=()=>{
      const w=R.map(row=>row.map(v=>v+rI(-4,4)||v+1));
      return mS(w);
    };
    const opts=makeOpts(cor,wrongGen);
    return{text:`Вычислите A^${n}:\nA = ${mS(A)}`,options:opts,correct:cor};
  },
  minor(){
    // Find minor M_ij and cofactor A_ij of element in 3x3 matrix
    const m=rM(3,3,-4,5);
    const r=rI(0,2), c=rI(0,2);
    // Minor = det of 2x2 submatrix excluding row r and col c
    const sub=m.filter((_,i)=>i!==r).map(row=>row.filter((_,j)=>j!==c));
    const minorVal=d2(sub);
    const cofactor=Math.pow(-1,r+c)*minorVal;
    const isMinor=Math.random()<0.5;
    const cor=String(isMinor?minorVal:cofactor);
    const w=new Set();
    const minorMistakes=[minorVal+rI(1,6), -minorVal, cofactor+rI(1,4), -cofactor, minorVal*2];
    for(const v of minorMistakes){if(String(v)!==cor&&!w.has(v))w.add(String(v));if(w.size>=3)break;}
    while(w.size<3){const v=rI(-60,60);if(String(v)!==cor&&!w.has(String(v)))w.add(String(v));}
    return{
      text:`Найдите ${isMinor?'минор M'+(r+1)+(c+1):'алгебраическое дополнение A'+(r+1)+(c+1)} элемента (${r+1},${c+1}):\n${mS(m)}`,
      options:shuf([cor,...[...w].map(String)]),
      correct:cor
    };
  }
};
/* ── FILL-IN GENERATORS ── */
const fillGen = {
  add_element(){
    // Дано A+B=C, найди пропущенный элемент C
    const A=rM(2,2,-4,6),B=rM(2,2,-4,6),C=mAdd(A,B);
    const r=rI(0,1),c=rI(0,1);
    const ans=String(C[r][c]);
    return{qtype:'fill',
      text:`Найдите сумму матриц A + B.\nЧему равен элемент c${r+1}${c+1} результата?`,
      matrices:[['A =',A],['B =',B],['C = A+B =',C,[r,c]]],
      correct:ans, fillLabel:`c${r+1}${c+1} =`, fillHint:'Сложи соответствующие элементы'};
  },
  scalar_element(){
    const A=rM(2,2,-4,5),k=rI(2,6),C=mScale(A,k);
    const r=rI(0,1),c=rI(0,1);
    const ans=String(C[r][c]);
    return{qtype:'fill',
      text:`Вычислите ${k} · A. Найдите элемент b${r+1}${c+1} результата.`,
      matrices:[['A =',A],['B = '+k+'·A =',C,[r,c]]],
      correct:ans, fillLabel:`b${r+1}${c+1} =`, fillHint:`Умножь a${r+1}${c+1} на ${k}`};
  },
  find_scalar(){
    const A=rM(2,2,-4,5),k=rI(2,6),C=mScale(A,k);
    return{qtype:'fill',
      text:`Найдите скаляр k, если k·A = B`,
      matrices:[['A =',A],['B =',C]],
      correct:String(k), fillLabel:'k =', fillHint:'Раздели любой элемент B на соответствующий элемент A'};
  },
  det2_element(){
    const m=rM(2,2,-5,7),det=d2(m);
    return{qtype:'fill',
      text:`Вычислите определитель матрицы 2×2`,
      matrices:[['A =',m]],
      correct:String(det), fillLabel:'det(A) =', fillHint:'det = a·d − b·c'};
  },
  multiply_element(){
    const A=rM(2,2,-3,4),B=rM(2,2,-3,4),C=mMul(A,B);
    const r=rI(0,1),c=rI(0,1);
    const ans=String(C[r][c]);
    return{qtype:'fill',
      text:`Найдите A·B. Чему равен элемент c${r+1}${c+1}?`,
      matrices:[['A =',A],['B =',B],['C = A·B =',C,[r,c]]],
      correct:ans, fillLabel:`c${r+1}${c+1} =`, fillHint:'Строка '+String(r+1)+' на столбец '+String(c+1)};
  },
  transpose_element(){
    const A=rM(2,3,-4,6),T=mT(A);
    const r=rI(0,2),c=rI(0,1);
    const ans=String(T[r][c]);
    return{qtype:'fill',
      text:`Найдите элемент (${r+1},${c+1}) транспонированной матрицы Aᵀ`,
      matrices:[['A =',A],['Aᵀ =',T,[r,c]]],
      correct:ans, fillLabel:`(Aᵀ)${r+1}${c+1} =`, fillHint:'При транспонировании строки становятся столбцами'};
  },
  size_fill(){
    const r=rI(2,4),c=rI(2,4),A=rM(r,c,-4,6);
    return{qtype:'fill',
      text:'Определите количество строк матрицы A',
      matrices:[['A =',A]],
      correct:String(r), fillLabel:'строк =', fillHint:'Считай горизонтальные строки'};
  }
};

/* ── TRUE/FALSE GENERATORS ── */
const tfGen = {
  det2_tf(){
    const m=rM(2,2,-5,7),real=d2(m);
    const isTrue=Math.random()<0.5;
    let shown=real;
    if(!isTrue){ do{shown=rI(-50,50);}while(shown===real); }
    return{qtype:'tf',
      text:`Верно ли, что det(A) = ${shown}?`,
      matrices:[['A =',m]],
      correct:isTrue?'true':'false'};
  },
  size_tf(){
    const r=rI(2,4),c=rI(2,4),A=rM(r,c,-4,6);
    const isTrue=Math.random()<0.5;
    let sr=r,sc=c;
    if(!isTrue){ if(Math.random()<0.5) sr=r===2?3:r-1; else sc=c===2?3:c-1; }
    return{qtype:'tf',
      text:`Верно ли, что размер матрицы A равен ${sr}×${sc}?`,
      matrices:[['A =',A]],
      correct:isTrue?'true':'false'};
  },
  add_tf(){
    const A=rM(2,2,-4,6),B=rM(2,2,-4,6),C=mAdd(A,B);
    const isTrue=Math.random()<0.5;
    let shown=C;
    if(!isTrue){const wr=mAdd(A,rM(2,2,-4,6));shown=wr;}
    return{qtype:'tf',
      text:'Верно ли, что A + B = C?',
      matrices:[['A =',A],['B =',B],['C =',shown]],
      correct:isTrue?'true':'false'};
  },
  scalar_tf(){
    const A=rM(2,2,-3,5),k=rI(2,5),C=mScale(A,k);
    const isTrue=Math.random()<0.5;
    let shown=C;
    if(!isTrue){shown=mScale(A,k+rI(1,3));}
    return{qtype:'tf',
      text:`Верно ли, что ${k}·A = B?`,
      matrices:[['A =',A],['B =',shown]],
      correct:isTrue?'true':'false'};
  },
  transpose_tf(){
    const A=rM(2,3,-4,6),T=mT(A);
    const isTrue=Math.random()<0.5;
    let shown=T;
    if(!isTrue){shown=rM(3,2,-4,6);}
    return{qtype:'tf',
      text:'Верно ли, что Aᵀ = B?',
      matrices:[['A =',A],['B =',shown]],
      correct:isTrue?'true':'false'};
  },
  multiply_tf(){
    const A=rM(2,2,-3,3),B=rM(2,2,-3,3),C=mMul(A,B);
    const isTrue=Math.random()<0.5;
    let shown=C;
    if(!isTrue){shown=mMul(B,A);} // B·A ≠ A·B usually
    return{qtype:'tf',
      text:'Верно ли, что A·B = C?',
      matrices:[['A =',A],['B =',B],['C =',shown]],
      correct:isTrue?'true':'false'};
  }
};

// Собираем пул всех генераторов для случайного типа
function randomQGen(topic){
  // 50% MCQ, 30% fill, 20% TF
  const r=Math.random();
  if(r<0.5) return G[topic]?G[topic]():null;
  if(r<0.8){
    // Pick relevant fill gen
    const fillMap={
      add:()=>fillGen.add_element(),
      scalar:()=>fillGen.scalar_element(),
      multiply_scalar:()=>Math.random()<0.5?fillGen.scalar_element():fillGen.find_scalar(),
      multiply:()=>fillGen.multiply_element(),
      transpose:()=>fillGen.transpose_element(),
      transpose_check:()=>fillGen.transpose_element(),
      det2:()=>fillGen.det2_element(),
      det3:()=>G.det3(), // keep MCQ for det3
      size:()=>fillGen.size_fill(),
      equal:()=>fillGen.add_element(),
      add_element:()=>fillGen.add_element(),
      inverse:()=>G.inverse(),
      rank:()=>G.rank(),
      sle:()=>G.sle(),
      matpow:()=>G.matpow(),
      minor:()=>G.minor(),
    };
    const fn=fillMap[topic];
    return fn?fn():G[topic]?G[topic]():null;
  }
  // TF
  const tfMap={
    add:()=>tfGen.add_tf(),
    equal:()=>tfGen.add_tf(),
    scalar:()=>tfGen.scalar_tf(),
    multiply_scalar:()=>tfGen.scalar_tf(),
    multiply:()=>tfGen.multiply_tf(),
    transpose:()=>tfGen.transpose_tf(),
    transpose_check:()=>tfGen.transpose_tf(),
    det2:()=>tfGen.det2_tf(),
    det3:()=>tfGen.det2_tf(),
    size:()=>tfGen.size_tf(),
    equal:()=>tfGen.add_tf(),
    inverse:()=>G.inverse(),
    rank:()=>G.rank(),
    sle:()=>G.sle(),
  };
  const fn=tfMap[topic];
  return fn?fn():G[topic]?G[topic]():null;
}

const TG={add:()=>randomQGen('add'),multiply:()=>randomQGen('multiply'),transpose:()=>randomQGen('transpose'),inverse:()=>G.inverse(),det:()=>G.det(),rank:()=>G.rank(),sle:()=>G.sle(),scalar:()=>randomQGen('scalar'),size:()=>randomQGen('size'),matpow:()=>G.matpow(),minor:()=>G.minor()};
const CG={add:()=>randomQGen('add'),multiply:()=>randomQGen('multiply'),transpose:()=>randomQGen('transpose_check'),scalar:()=>randomQGen('scalar'),size:()=>randomQGen('size'),det:()=>randomQGen('det2'),det2:()=>randomQGen('det2'),det3:()=>G.det3(),inverse:()=>G.inverse(),rank:()=>G.rank(),sle:()=>G.sle(),matpow:()=>G.matpow(),minor:()=>G.minor()};

/* ═══════════════════════════════════════════
   LOGIN
═══════════════════════════════════════════ */
async function doLogin(){
  const name=document.getElementById('inp-name').value.trim();
  const surname=document.getElementById('inp-surname').value.trim();
  const cls=document.getElementById('inp-class').value;
  if(!name||!surname){showToast('Введите имя и фамилию!');return;}
  if(!cls){showToast('Выберите класс!');return;}
  const btn=document.getElementById('btn-login');
  btn.disabled=true;btn.innerHTML='<span class="spinner"></span> Вход...';
  try{
    const data=await apiPost('/api/users/register',{first_name:name,last_name:surname,grade:cls});
    user={id:data.id,name,surname,cls};
    document.getElementById('top-name').textContent=name+' '+surname;
    document.getElementById('top-grade').textContent=cls+' класс';
    await buildAllTestsList();buildTypedGrid();await buildStudentCtrlPage();
    switchPage('tests');showScreen('main');
  }catch(e){showToast('Ошибка: '+e.message);}
  finally{btn.disabled=false;btn.textContent='Войти в систему';}
}
function doLogout(){user=null;lastResultId=null;clearInterval(timerInterval);['inp-name','inp-surname'].forEach(id=>document.getElementById(id).value='');document.getElementById('inp-class').value='';showScreen('login');}

/* ═══════════════════════════════════════════
   BUILD LISTS
═══════════════════════════════════════════ */
function buildTestList(){
  const bc={easy:'badge-easy',medium:'badge-medium',hard:'badge-hard'};
  document.getElementById('test-list-container').innerHTML=TESTS.map(t=>`
    <div class="test-card">
      <div class="test-card-title">${t.title}</div>
      <div class="test-card-desc">${t.desc}</div>
      <div class="test-card-meta"><span class="badge ${bc[t.difficulty]}">${t.diffLabel}</span><span class="meta-item">🏆 ${t.questions} вопросов</span><span class="meta-item">🕐 ${t.time} мин</span></div>
      <button class="btn-start" onclick="openTestInfo(${t.id})">Начать тест</button>
    </div>`).join('');
}
function buildTypedGrid(){
  const grade = userGrade();
  document.getElementById('typed-grid').innerHTML=TYPED_OPS.map(op=>{
    const locked = isTopicLocked(op.key);
    const unavail = !isTopicAvailable(op.key) && !locked;
    if(unavail) return ''; // completely hidden
    const lockHtml = locked ? `<div class="lock-badge">🔒</div><div class="locked-tip">Доступно с ${op.minGrade} класса</div>` : '';
    return `<div class="typed-card${locked?' locked':''}" id="tc-${op.key}" onclick="${locked?'showLockedTip()':"selectOp('"+op.key+"')"}">
      <div class="typed-card-icon">${op.icon}</div>
      <div class="typed-card-title">${op.title}</div>
      <div class="typed-card-desc">${op.desc}</div>
      ${lockHtml}
    </div>`;
  }).join('');
}
function showLockedTip(){ showToast('Эта тема будет доступна в следующем классе 🔒'); }
function selectOp(key){
  selectedOperation=key;
  document.querySelectorAll('.typed-card').forEach(c=>c.classList.remove('sel'));
  document.getElementById('tc-'+key).classList.add('sel');
  document.getElementById('qty-box').style.display='';
  document.getElementById('btn-start-typed').style.display='';
}
function selectQty(n){selectedQty=n;document.querySelectorAll('.qty-btn').forEach(b=>b.classList.remove('sel'));document.getElementById('qty-'+n).classList.add('sel');}

/* ═══════════════════════════════════════════
   START FLOWS
═══════════════════════════════════════════ */
async function openTestInfo(id){currentMode='test';const custom=await loadCustomTests();const all=[...TESTS,...custom];currentTestDef=all.find(t=>t.id===id);openInfo();}
function startTypedTest(){if(!selectedOperation){showToast('Выберите операцию!');return;}if(isTopicLocked(selectedOperation)){showToast('Эта тема недоступна для вашего класса 🔒');return;}const op=TYPED_OPS.find(o=>o.key===selectedOperation);currentMode='typed';currentTestDef={id:100+TYPED_OPS.indexOf(op),title:'Типовые: '+op.title,desc:op.desc,diffLabel:'Типовые',questions:selectedQty,time:45,topics:[]};openInfo();}
function startControlWork_builtin(){
  currentMode='control';
  const total=rI(15,20);
  const avail = GRADE_TOPICS[userGrade()]||GRADE_TOPICS[9];
  const pool=shuf([...avail,...avail,...avail]);
  currentTestDef={id:999,title:'Контрольная работа',desc:'Проверка знаний по всем операциям',diffLabel:'Контрольная',questions:total,time:60,topics:shuf(pool).slice(0,total)};
  openInfo();
}
function goBackFromInfo(){
  if(launchScreen==='super'){
    showScreen('super');
    superPage(currentSuperPage||'tests');
  } else {
    showScreen('main');
  }
}
function openInfo(){
  launchScreen = superUser ? 'super' : 'main';
  document.getElementById('info-title').textContent=currentTestDef.title;
  document.getElementById('info-desc').textContent=currentTestDef.desc;
  document.getElementById('info-q-count').textContent='Количество вопросов: '+currentTestDef.questions;
  document.getElementById('info-time').textContent='Время: '+currentTestDef.time+' минут';
  document.getElementById('info-diff').textContent='Режим: '+currentTestDef.diffLabel;
  showScreen('info');
}

/* ═══════════════════════════════════════════
   TEST FLOW
═══════════════════════════════════════════ */
let mascotMessageTimer=null, mascotFrameTimer=null, mascotDanceActive=false, mascotIntroActive=false;
const MASCOT_FRAMES={idle:4,hello:3,dance:4,happy:4,wrong:3,victory:4,think:4,peek:3};
let mascotCurrentMood='idle';
function mascotSetFrames(name,count,speed=650){
 const sprite=document.getElementById('mascot-sprite'); if(!sprite)return;
 clearInterval(mascotFrameTimer); let frame=1;
 sprite.src=`/assets/mascot/${name}_${frame}.png`;
 if(count>1)mascotFrameTimer=setInterval(()=>{frame=frame%count+1;sprite.src=`/assets/mascot/${name}_${frame}.png`;},speed);
 mascotCurrentMood=name;
}
function mascotScreenState(id){
 const w=document.getElementById('mascot-widget'); if(!w)return;
 w.classList.toggle('main-peek',id==='main');
 if(id==='result')return; // preserve the final-result emotion
 if(id==='question'){mascotSetFrames('idle',4,850);return;}
 if(id==='main'){
   if(!mascotIntroActive&&!mascotDanceActive)mascotSetFrames('peek',3,850);
   return;
 }
 if(!mascotIntroActive&&!mascotDanceActive)mascotSetFrames('idle',4,850);
}
function mascotStartIntro(){
 const w=document.getElementById('mascot-widget'); if(!w)return;
 mascotIntroActive=true; w.classList.remove('main-peek'); w.classList.add('intro','message'); mascotSetFrames('hello',3,1000);
 const m=document.getElementById('mascot-message'); if(m)m.textContent='Привет! Я Матрикс.';
 setTimeout(()=>{
   mascotIntroActive=false;w.classList.remove('intro','message');
   const active=document.querySelector('.screen.active');
   mascotScreenState(active?active.id.replace('screen-',''):'login');
 },3000);
}
function mascotSay(message,mood='think',keepOpen=false){
 const w=document.getElementById('mascot-widget'),m=document.getElementById('mascot-message');
 if(!w||!m)return; m.textContent=message;w.classList.add('message');
 mascotSetFrames(mood,MASCOT_FRAMES[mood]||4,mood==='help'?900:650);
 if(keepOpen)w.classList.add('open');clearTimeout(mascotMessageTimer);
 if(!keepOpen)mascotMessageTimer=setTimeout(()=>w.classList.remove('message'),4200);
}
function mascotToggle(){
 const w=document.getElementById('mascot-widget');if(!w)return;
 w.classList.toggle('open');
 if(w.classList.contains('open')){w.classList.remove('message');const m=document.getElementById('mascot-message');if(m)m.textContent='Нужна подсказка? Нажми кнопку ниже — подберу её под задание.';mascotSetFrames('peek',3,700);}
 else mascotScreenState(document.querySelector('.screen.active')?.id.replace('screen-','')||'login');
}
function mascotShowHint(event){
 if(event)event.stopPropagation();
 const q=currentQuestions[currentQ],s=((q&&(q.text||q.title||q.question))||'').toLowerCase();
 let h=(q&&q.hint)||((q&&q.fillHint)||'');
 if(!h){
  if(/определител|det\s*\(?a\)?|det\(/i.test(s))h='Для матрицы 2×2 перемножь элементы главной диагонали, затем вычти произведение элементов побочной диагонали.';
  else if(/обратн|a⁻¹|a\^-1/i.test(s))h='Сначала вычисли det(A). Если он равен нулю, обратной матрицы нет. Для 2×2 поменяй местами элементы главной диагонали и измени знаки у побочной.';
  else if(/произведени|a·b/i.test(s))h='Выбери строку первой матрицы и столбец второй. Перемножь элементы попарно и сложи полученные произведения.';
  else if(/транспонир|aᵀ|a\^t/i.test(s))h='При транспонировании строки исходной матрицы становятся столбцами. Элемент aᵢⱼ переходит на позицию aⱼᵢ.';
  else if(/ранг/i.test(s))h='Приведи матрицу к ступенчатому виду. Количество ненулевых строк — это ранг.';
  else if(/систем|x₁|x1/i.test(s))h='Можно применить метод Крамера: найди главный определитель, затем определители с заменёнными столбцами.';
  else if(/скаляр|k\s*·|умножьте на/i.test(s))h='Умножь каждый элемент матрицы на заданный скаляр. Размер матрицы не меняется.';
  else if(/сумм|a\s*\+\s*b/i.test(s))h='Складывай элементы, стоящие на одинаковых позициях. Размеры матриц должны совпадать.';
  else if(/размер матриц|количество строк/i.test(s))h='Строки считаются горизонтально, столбцы — вертикально. Размер записывается как строки × столбцы.';
  else h='Для этой темы пока нет отдельной подсказки. Открой соответствующий раздел теории и проверь правило операции.';
 }
 mascotSay(h,'think',true);
}
function mascotReactToFinalResult(percent){
 const w=document.getElementById('mascot-widget');if(!w)return;
 w.classList.remove('message','open');
 // Emotion is shown only after the whole test is submitted, never after an individual answer.
 if(percent>=90)mascotSetFrames('victory',4,520);
 else if(percent>=70)mascotSetFrames('happy',4,600);
 else if(percent<50)mascotSetFrames('wrong',3,750);
 else mascotSetFrames('think',4,850);
}
const mascotWidget=document.getElementById('mascot-widget');
if(mascotWidget){
 mascotWidget.addEventListener('mouseenter',()=>{
   if(mascotIntroActive)return;
   const active=document.querySelector('.screen.active');
   if(active&&active.id==='screen-main'){
     mascotDanceActive=true;mascotSetFrames('dance',4,260);
   }
 });
 mascotWidget.addEventListener('mouseleave',()=>{
   mascotDanceActive=false;
   const active=document.querySelector('.screen.active');
   if(!mascotIntroActive&&!(active&&active.id==='screen-result'))mascotScreenState(active?active.id.replace('screen-',''):'login');
 });
 window.addEventListener('load',mascotStartIntro,{once:true});
}


function startTest(){
  if(currentMode==='typed') currentQuestions=Array(currentTestDef.questions).fill(null).map(()=>TG[selectedOperation]());
  else if(currentMode==='control'){
    currentQuestions=currentTestDef.topics.map(t=>{const fn=CG[t];return fn?fn():null;}).filter(Boolean);
    if(!currentQuestions.length){showToast('Не удалось сгенерировать вопросы');return;}
  }
  else currentQuestions=currentTestDef.topics.map(t=>randomQGen(t)||(G[t]?G[t]():null)||G.add()).filter(Boolean);
  if(!currentQuestions.length){showToast('Не удалось сгенерировать вопросы');return;}
  currentQuestions=shuf(currentQuestions); // random order every time
  currentAnswers={};currentQ=0;lastResultId=null;
  timerRemaining=currentTestDef.time*60;testStartTime=Date.now();
  showScreen('question');renderQ();startTimer();
}
function startTimer(){clearInterval(timerInterval);updTimer();timerInterval=setInterval(()=>{timerRemaining--;updTimer();if(timerRemaining<=0){clearInterval(timerInterval);finishTest(true);}},1000);}
function updTimer(){const m=String(Math.floor(timerRemaining/60)).padStart(2,'0'),s=String(timerRemaining%60).padStart(2,'0'),el=document.getElementById('q-timer');el.textContent=m+':'+s;el.classList.toggle('warning',timerRemaining<=60);}
function renderQ(){
  const q=currentQuestions[currentQ],tot=currentQuestions.length;
  document.getElementById('q-test-title').textContent=currentTestDef.title;
  document.getElementById('q-progress').textContent=`Вопрос ${currentQ+1} из ${tot}`;
  document.getElementById('q-text').innerHTML=renderQText(q);
  const sel=currentAnswers[currentQ];
  const optsEl=document.getElementById('q-options');

  if(q.qtype==='fill'){
    optsEl.innerHTML=`
      <div class="fill-wrap">
        <span class="fill-hint mono" style="font-weight:700;font-size:15px">${escHtml(q.fillLabel||'Ответ:')}</span>
        <input class="fill-input" id="fill-inp" type="text" placeholder="введите число"
          value="${sel||''}" oninput="onFillInput(this)" autocomplete="off">
        <span class="fill-hint">${escHtml(q.fillHint||'')}</span>
      </div>`;
  } else if(q.qtype==='tf'){
    const sv=sel||'';
    optsEl.innerHTML=`
      <div class="tf-btns">
        <button class="tf-btn ${sv==='true'?'selected-true':''}" onclick="selTF('true',this)">✓ Верно</button>
        <button class="tf-btn ${sv==='false'?'selected-false':''}" onclick="selTF('false',this)">✗ Неверно</button>
      </div>`;
  } else {
    optsEl.innerHTML=(q.options||[]).map((opt,i)=>`<label class="option ${sel===opt?'selected':''}" onclick="selOpt(${i},this)"><input type="radio" name="qopt" ${sel===opt?'checked':''}><span class="mono">${escHtml(opt)}</span></label>`).join('');
  }
  document.getElementById('btn-prev').disabled=currentQ===0;
  document.getElementById('btn-next').textContent=currentQ===tot-1?'Завершить →':'далее →';
}
function selOpt(idx,el){currentAnswers[currentQ]=currentQuestions[currentQ].options[idx];document.querySelectorAll('.option').forEach(l=>l.classList.remove('selected'));el.classList.add('selected');}
function selTF(val,el){currentAnswers[currentQ]=val;document.querySelectorAll('.tf-btn').forEach(b=>{b.classList.remove('selected-true','selected-false');});el.classList.add(val==='true'?'selected-true':'selected-false');}
function onFillInput(inp){
  currentAnswers[currentQ]=inp.value.trim();
}
function prevQuestion(){if(currentQ>0){currentQ--;renderQ();}}
function nextQuestion(){
  const q=currentQuestions[currentQ];
  if(q.qtype==='fill'){
    const inp=document.getElementById('fill-inp');
    if(inp) currentAnswers[currentQ]=inp.value.trim();
    if(!currentAnswers[currentQ]){showToast('Введите ответ!');return;}
  } else if(currentAnswers[currentQ]===undefined){showToast('Выберите ответ!');return;}
  if(currentQ<currentQuestions.length-1){currentQ++;renderQ();}else finishTest(false);}
function cancelTest(){clearInterval(timerInterval);showScreen(launchScreen);if(launchScreen==='super'){superPage(currentSuperPage||'tests');}}

/* ═══════════════════════════════════════════
   FINISH
═══════════════════════════════════════════ */
const GCOL={5:'#22c55e',4:'#84cc16',3:'#f59e0b',2:'#ef4444'};
const GEMO={5:'🏆',4:'👍',3:'📚',2:'📖'};
function grade(p){return p>=80?5:p>=60?4:p>=40?3:2;}

/* finishTest defined below */

/* ═══════════════════════════════════════════
   HISTORY
═══════════════════════════════════════════ */
async function loadHistory(){
  const c=document.getElementById('history-container');c.innerHTML='<div class="history-empty">Загрузка...</div>';
  try{
    const res=await apiGet(`/api/tests/results/user/${user.id}`);
    if(!res.length){c.innerHTML='<div class="history-empty">Вы ещё не проходили тесты 📝</div>';return;}
    c.innerHTML=res.map(r=>{const sc=r.percentage>=70?'sg':r.percentage>=50?'sy':'sr';const mm=String(Math.floor(r.time_spent/60)).padStart(2,'0'),ss=String(r.time_spent%60).padStart(2,'0');const date=r.timestamp?new Date(r.timestamp).toLocaleString('ru-RU'):'—';return`<div class="hcard"><div><div class="hcard-title">${escHtml(r.test_title)}</div><div class="hcard-meta">${date} · ${r.correct_answers} из ${r.total_questions} верных · ⏱ ${mm}:${ss}</div></div><div class="hcard-right"><div class="hscore ${sc}">${r.percentage}%</div><button class="btn-review" onclick="showReview(${r.id})">🔍 Разбор</button><button class="btn-dl" onclick="downloadById(${r.id})">📄 Word</button></div></div>`;}).join('');
  }catch(e){c.innerHTML='<div class="history-empty">Не удалось загрузить историю</div>';}
}
async function downloadById(id){window.location.href=`/api/tests/results/${id}/word`;showToast('Скачивается...');}

async function showReview(id, studentId=user.id){
  try{
    const res=await apiGet(`/api/tests/results/user/${studentId}`);
    const r=res.find(x=>x.id===id);
    if(!r){showToast('Не удалось загрузить');return;}
    let detailed=[];
    try{detailed=JSON.parse(r.detailed_results);}catch(e){}
    document.getElementById('review-title').textContent='Разбор: '+r.test_title;
    const mm=String(Math.floor(r.time_spent/60)).padStart(2,'0'),ss=String(r.time_spent%60).padStart(2,'0');
    const date=r.timestamp?new Date(r.timestamp).toLocaleString('ru-RU'):'—';
    document.getElementById('review-meta').innerHTML=
      `${date} &nbsp;·&nbsp; <b>${r.correct_answers} из ${r.total_questions} верных</b> &nbsp;·&nbsp; ${r.percentage}% &nbsp;·&nbsp; ⏱ ${mm}:${ss}`;
    const explainMap={
      'сумму':'Складывайте элементы с одинаковыми позициями (i,j).',
      'скаляр':'Умножьте каждый элемент матрицы на k.',
      'транспон':'Строки становятся столбцами: (Aᵀ)ᵢⱼ = Aⱼᵢ.',
      'a⁻¹':'A⁻¹ = (1/det)·[[d,−b],[−c,a]], det = ad−bc.',
      '2×2':'det = a·d − b·c. Главная диагональ минус побочная.',
      '3×3':'Разложение по первой строке: det = a(ei−fh) − b(di−fg) + c(dh−eg).',
      'произведение':'c_ij = Σ a_ik·b_kj. Строка на столбец.',
      'ранг':'Приведите к ступенчатому виду. Ранг = ненулевые строки.',
      'систему':'x_i = det(Aᵢ)/det(A) — метод Крамера.',
      'размер':'Формат: строки × столбцы.',
      'степень':'A^n — перемножьте матрицу на себя n раз.',
      'минор':'Вычеркните строку i и столбец j, возьмите определитель.'
    };
    function getExplain(q){
      const ql=q.toLowerCase();
      for(const[k,v] of Object.entries(explainMap)){if(ql.includes(k))return v;}
      return null;
    }
    document.getElementById('review-body').innerHTML=detailed.map((q,i)=>{
      const ok=q.is_correct;
      const qText=escHtml((q.question||'').replace(/\n/g,' · '));
      const uAns=escHtml(q.user_answer||'(не отвечено)');
      const cAns=escHtml(q.correct_answer||'');
      const exp=!ok?getExplain(q.question||''):null;
      return `<div class="review-item ${ok?'correct':'wrong'}">
        <div class="review-num">Вопрос ${i+1}</div>
        <div class="review-q">${qText}</div>
        <div class="review-answers">
          <span class="review-ans-user ${ok?'ok':'err'}">${ok?'✓':'✗'} ${uAns}</span>
          ${!ok?`<span class="review-ans-correct">✓ ${cAns}</span>`:''}
        </div>
        ${exp?`<div class="review-explain">💡 ${escHtml(exp)}</div>`:''}
      </div>`;
    }).join('');
    document.getElementById('review-modal').classList.add('open');
  }catch(e){showToast('Ошибка загрузки разбора');}
}
function closeReview(e){
  if(e&&e.target!==document.getElementById('review-modal'))return;
  document.getElementById('review-modal').classList.remove('open');
}

/* ═══════════════════════════════════════════
   WORD
═══════════════════════════════════════════ */
function downloadWord(){if(lastResultId){window.location.href=`/api/tests/results/${lastResultId}/word`;showToast('Скачивается...');}else if(window._localResult)dlLocal(window._localResult);}
/* ═══════════════════════════════════════════
   DAILY TASK
═══════════════════════════════════════════ */

// Seeded random от даты — одна задача на весь день для всех
function seededRand(seed) {
  let s = seed;
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff;
    return (s >>> 0) / 0xffffffff;
  };
}

function getTodaySeed() {
  const d = new Date();
  // Use day of year for more variation
  const start = new Date(d.getFullYear(), 0, 0);
  const diff = d - start;
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return d.getFullYear() * 1000 + dayOfYear;
}

function seededInt(rand, a, b) {
  return Math.floor(rand() * (b - a + 1)) + a;
}

function seededMatrix(rand, rows, cols, a, b) {
  return Array.from({length: rows}, () =>
    Array.from({length: cols}, () => seededInt(rand, a, b))
  );
}

function seededShuffle(rand, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function generateDailyTask() {
  const seed = getTodaySeed();
  const rand = seededRand(seed);
  // Use day of year mod 7 to rotate through task types + rand for variety
  const dToday = new Date();
  const start = new Date(dToday.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((dToday - start) / 86400000);
  const baseType = dayOfYear % 6; // cycles 0-5 over 6 days
  const type = baseType; // deterministic by day
  // types: 0=det3, 1=inverse, 2=multiply3, 3=det2hard, 4=rank3, 5=sle3

  if (type === 0) {
    // det 3x3
    const m = seededMatrix(rand, 3, 3, -5, 6);
    const c = d3(m);
    const wrong = new Set();
    while (wrong.size < 3) { const v = seededInt(rand, -300, 300); if (v !== c) wrong.add(v); }
    return {
      type: 'det3',
      title: 'Вычислите определитель матрицы 3×3',
      question: mS(m),
      options: seededShuffle(rand, [c, ...[...wrong]]).map(String),
      correct: String(c),
      hint: 'Разложите по первой строке: det = a(ei−fh) − b(di−fg) + c(dh−eg)'
    };
  }
  if (type === 1) {
    // inverse 2x2
    let m, inv;
    let tries = 0;
    do {
      m = seededMatrix(rand, 2, 2, -4, 5);
      const det = m[0][0]*m[1][1] - m[0][1]*m[1][0];
      inv = det !== 0 ? [[m[1][1]/det, -m[0][1]/det], [-m[1][0]/det, m[0][0]/det]] : null;
      tries++;
    } while (!inv && tries < 20);
    if (!inv) { m = [[2,1],[1,3]]; const detFallback=5; inv=[[3/detFallback,-1/detFallback],[-1/detFallback,2/detFallback]]; }
    const fmt = n => { const r=Math.round(n*100)/100; return r===Math.floor(r)?String(r):r.toFixed(2); };
    const cor = '[' + inv.map(r=>'['+r.map(fmt).join(', ')+']').join(', ') + ']';
    const wrongs = [];
    while (wrongs.length < 3) {
      const wm = seededMatrix(rand, 2, 2, -4, 5);
      const wd = wm[0][0]*wm[1][1]-wm[0][1]*wm[1][0];
      if (wd === 0) continue;
      const wi = '[' + [[wm[1][1]/wd,-wm[0][1]/wd],[-wm[1][0]/wd,wm[0][0]/wd]].map(r=>'['+r.map(fmt).join(', ')+']').join(', ') + ']';
      if (wi !== cor && !wrongs.includes(wi)) wrongs.push(wi);
    }
    return {
      type: 'inverse',
      title: 'Найдите обратную матрицу A⁻¹',
      question: mS(m),
      options: seededShuffle(rand, [cor, ...wrongs]),
      correct: cor,
      hint: 'A⁻¹ = (1/det)·[[d,−b],[−c,a]], где det = ad−bc'
    };
  }
  if (type === 2) {
    // multiply 3x3
    const A = seededMatrix(rand, 2, 3, -3, 3);
    const B = seededMatrix(rand, 3, 2, -3, 3);
    const C = mMul(A, B);
    const cor = mS(C);
    const wrong = new Set();
    while (wrong.size < 3) {
      const w = mS(seededMatrix(rand, 2, 2, -15, 15));
      if (w !== cor) wrong.add(w);
    }
    return {
      type: 'multiply',
      title: 'Найдите произведение матриц A·B',
      question: `A = ${mS(A)}
B = ${mS(B)}`,
      options: seededShuffle(rand, [cor, ...[...wrong]]),
      correct: cor,
      hint: 'c_ij = сумма произведений элементов i-й строки A на j-й столбец B'
    };
  }
  if (type === 3) {
    // det 2x2 with larger numbers
    const m = seededMatrix(rand, 2, 2, -9, 9);
    const c = d2(m);
    const wrong = new Set();
    while (wrong.size < 3) { const v = seededInt(rand, -100, 100); if (v !== c) wrong.add(v); }
    return {
      type: 'det2hard',
      title: 'Вычислите определитель матрицы 2×2',
      question: mS(m),
      options: seededShuffle(rand, [c, ...[...wrong]]).map(String),
      correct: String(c),
      hint: 'det(A) = a·d − b·c. Главная диагональ минус побочная'
    };
  }
  if (type === 4) {
    // rank 3x3
    const m = seededMatrix(rand, 3, 3, -3, 3);
    const c = mRank(m);
    const all = [0,1,2,3].filter(v=>v!==c);
    const wrong = seededShuffle(rand, all).slice(0,3);
    return {
      type: 'rank',
      title: 'Определите ранг матрицы 3×3',
      question: mS(m),
      options: seededShuffle(rand, [String(c), ...wrong.map(String)]),
      correct: String(c),
      hint: 'Приведите к ступенчатому виду методом Гаусса. Ранг = число ненулевых строк'
    };
  }
  // type 5 — SLE 3 variables (2x2 system with bigger numbers)
  const A = seededMatrix(rand, 2, 2, -4, 4);
  const b = [seededInt(rand,-8,8), seededInt(rand,-8,8)];
  const detA = d2(A);
  if (detA === 0) {
    // fallback to det3
    const m = seededMatrix(rand, 3, 3, -4, 5);
    const cv = d3(m);
    const ww = new Set();
    while(ww.size<3){const v=seededInt(rand,-300,300);if(v!==cv)ww.add(v);}
    return {type:'det3',title:'Вычислите определитель матрицы 3×3',question:mS(m),options:seededShuffle(rand,[cv,...[...ww]]).map(String),correct:String(cv),hint:'Разложите по первой строке со знаками +−+'};
  }
  const x1 = d2([[b[0],A[0][1]],[b[1],A[1][1]]]) / detA;
  const x2 = d2([[A[0][0],b[0]],[A[1][0],b[1]]]) / detA;
  const fmt2 = n => { const r=Math.round(n*100)/100; return r===Math.floor(r)?String(r):r.toFixed(2); };
  const cor = `x₁=${fmt2(x1)}, x₂=${fmt2(x2)}`;
  const wrong2 = [];
  while (wrong2.length<3) {
    const s=`x₁=${seededInt(rand,-9,9)}, x₂=${seededInt(rand,-9,9)}`;
    if(s!==cor&&!wrong2.includes(s)) wrong2.push(s);
  }
  return {
    type: 'sle',
    title: 'Решите систему линейных уравнений',
    question: `${A[0][0]}x₁ + ${A[0][1]}x₂ = ${b[0]}\n${A[1][0]}x₁ + ${A[1][1]}x₂ = ${b[1]}`,
    options: seededShuffle(rand, [cor, ...wrong2]),
    correct: cor,
    hint: 'Метод Крамера: x_i = det(Aᵢ)/det(A)'
  };
}

let dailyAnswered = false;
let dailyTask = null;

function renderDailyOption(opt) {
  const mat = matFromStr(opt);
  if (mat && Array.isArray(mat[0])) {
    return `<div class="mat-row" style="justify-content:center;margin:0">${renderMatrix(mat)}</div>`;
  }
  return `<span class="mono">${escHtml(opt)}</span>`;
}

function buildDailyPage() {

}

function buildDailyPage() {
  // Streak from localStorage
  const today = new Date().toISOString().slice(0,10);
  let streak = 0, lastDay = '';
  try {
    streak  = parseInt(localStorage.getItem('mx_streak_'+user.id) || '0');
    lastDay = localStorage.getItem('mx_streak_day_'+user.id) || '';
  } catch(e) {}

  const container = document.getElementById('daily-container');
  const dateEl = document.getElementById('daily-date');
  dateEl.textContent = 'Ежедневная задача повышенной сложности · ' + new Date().toLocaleDateString('ru-RU', {weekday:'long',day:'numeric',month:'long'});

  dailyTask = generateDailyTask();

  // Check if already answered today
  let answeredToday = false;
  let savedAnswer = '';
  try {
    const key = 'mx_daily_' + user.id + '_' + today;
    savedAnswer = localStorage.getItem(key) || '';
    answeredToday = !!savedAnswer;
  } catch(e) {}

  const streakHtml = streak > 0 ? `
    <div class="daily-streak">
      <div class="daily-streak-left">
        <div class="daily-streak-num">${streak} ${streak===1?'день':streak<5?'дня':'дней'}</div>
        <div class="daily-streak-label">Серия решений подряд</div>
      </div>
      <div class="daily-streak-icon">🔥</div>
    </div>` : '';

  // Build question HTML with proper matrix visualization
  function renderDailyLine(line) {
    const re2 = /((?:[A-Za-zА-Яа-яёЁ·\^Tᵀ⁻¹\d]+\s*=\s*)?)(\[(?:\[[\d\s,.\-]+\](?:,\s*)?)+\])/g;
    let parts = [], m2, lastEnd = 0, hasMatrix = false;
    while ((m2 = re2.exec(line)) !== null) {
      hasMatrix = true;
      const before = line.slice(lastEnd, m2.index);
      if (before.trim()) parts.push({type:'text', val: before.trim()});
      const label = m2[1].trim();
      const mat = matFromStr(m2[2]);
      if (mat && Array.isArray(mat[0])) parts.push({type:'matrix', label, mat});
      else parts.push({type:'text', val: m2[0]});
      lastEnd = m2.index + m2[0].length;
    }
    const tail = line.slice(lastEnd).trim();
    if (tail) parts.push({type:'text', val: tail});
    if (!hasMatrix) return `<div class="daily-matrix mono">${escHtml(line)}</div>`;
    let html = '<div class="mat-row" style="margin:6px 0">';
    for (const p of parts) {
      if (p.type === 'text') html += `<span class="mat-row-label">${escHtml(p.val)}</span>`;
      else {
        const lbl = p.label ? `<span class="mat-row-label">${escHtml(p.label)}</span>` : '';
        html += `<div class="mat-row-item">${lbl}${renderMatrix(p.mat)}</div>`;
      }
    }
    html += '</div>';
    return html;
  }

  const lines = dailyTask.question.split('\n');
  let qHtml = `<div class="daily-question">${escHtml(dailyTask.title)}</div>`;
  for (let i = 0; i < lines.length; i++)
    qHtml += renderDailyLine(lines[i]);

  if (answeredToday) {
    const wasCorrect = savedAnswer === dailyTask.correct;
    container.innerHTML = streakHtml + `
      <div class="daily-card">
        <div class="daily-badge">🌟 Задача дня выполнена</div>
        ${qHtml}
        <div class="daily-options">
          ${dailyTask.options.map(opt => {
            const isCor=opt===dailyTask.correct, isWrong=opt===savedAnswer&&!wasCorrect;
            const style='cursor:default;'+(isCor?'border-color:#22c55e;background:#f0fdf4':'')+(isWrong?';border-color:#ef4444;background:#fef2f2':'');
            return '<label class="option '+(isCor?'selected':'')+'" style="'+style+'"><input type="radio" disabled '+(opt===savedAnswer?'checked':'')+'>'+
              renderDailyOption(opt)+'</label>';
          }).join('')}
        </div>
        <div class="daily-result ${wasCorrect?'correct':'wrong'}" style="display:block">
          ${wasCorrect ? '✓ Верно! Отличная работа!' : '✗ Неверно. Правильный ответ: '+renderDailyOption(dailyTask.correct)+'<div class="daily-explain">💡 '+escHtml(dailyTask.hint)+'</div>'}
        </div>
      </div>
      <div class="daily-done">
        <div class="daily-done-icon">${wasCorrect?'🏆':'📖'}</div>
        <div class="daily-done-title">${wasCorrect?'Задача решена верно!':'Не расстраивайся!'}</div>
        <div class="daily-done-sub">Новая задача появится завтра</div>
      </div>`;
    return;
  }

  dailyAnswered = false;
  container.innerHTML = streakHtml + `
    <div class="daily-card">
      <div class="daily-badge">🌟 Задача дня · Повышенная сложность</div>
      ${qHtml}
      <div class="daily-options" id="daily-opts">
        ${dailyTask.options.map((opt,i) => '<label class="option" id="dopt-'+i+'" onclick="selectDailyOpt('+i+',this)"><input type="radio" name="daily">'+renderDailyOption(opt)+'</label>').join('')}
      </div>
      <div class="daily-result" id="daily-result"></div>
      <button class="btn-start" id="btn-daily-submit" style="margin-top:14px;display:none" onclick="submitDaily()">Проверить ответ</button>
    </div>`;
}

let selectedDailyOpt = null;
function selectDailyOpt(idx, el) {
  if (dailyAnswered) return;
  selectedDailyOpt = idx;
  document.querySelectorAll('.daily-options .option').forEach(l=>l.classList.remove('selected'));
  el.classList.add('selected');
  document.getElementById('btn-daily-submit').style.display = '';
}

function submitDaily() {
  if (selectedDailyOpt === null) return;
  dailyAnswered = true;
  const chosen = dailyTask.options[selectedDailyOpt];
  const correct = chosen === dailyTask.correct;
  const today = new Date().toISOString().slice(0,10);

  // Save answer
  try { localStorage.setItem('mx_daily_' + user.id + '_' + today, chosen); } catch(e) {}


  // Update streak
  try {
    let streak = parseInt(localStorage.getItem('mx_streak_'+user.id) || '0');
    const lastDay = localStorage.getItem('mx_streak_day_'+user.id) || '';
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);

    if (correct) {
      streak = lastDay === yesterday || lastDay === today
        ? streak + (lastDay === today ? 0 : 1)
        : 1;

      localStorage.setItem('mx_streak_'+user.id, streak);
      localStorage.setItem('mx_streak_day_'+user.id, today);
    }

    // Immediately update streak on the page
    const container = document.getElementById('daily-container');
    let streakElement = container.querySelector('.daily-streak');

    if (correct) {
      const word = streak === 1 ? 'день' : streak < 5 ? 'дня' : 'дней';

      const streakHtml = `
        <div class="daily-streak">
          <div class="daily-streak-left">
            <div class="daily-streak-num">${streak} ${word}</div>
            <div class="daily-streak-label">Серия решений подряд</div>
          </div>
          <div class="daily-streak-icon">🔥</div>
        </div>`;

      if (streakElement) {
        streakElement.outerHTML = streakHtml;
      } else {
        container.insertAdjacentHTML('afterbegin', streakHtml);
      }
    }
  } catch(e) {
    console.error('Ошибка обновления стрика:', e);
  }

  // Highlight options
  document.querySelectorAll('.daily-options .option').forEach((el, i) => {
    const opt = dailyTask.options[i];
    if (opt === dailyTask.correct) { el.style.borderColor='#22c55e'; el.style.background='#f0fdf4'; }
    else if (i === selectedDailyOpt && !correct) { el.style.borderColor='#ef4444'; el.style.background='#fef2f2'; }
    el.style.cursor = 'default';
  });

  const resEl = document.getElementById('daily-result');
  resEl.style.display = 'block';
  resEl.className = 'daily-result ' + (correct?'correct':'wrong');
  resEl.innerHTML = correct
    ? '✓ Верно! Отличная работа! 🎉'
    : '✗ Неверно. Правильный ответ: '+renderDailyOption(dailyTask.correct)+'<div class="daily-explain">💡 '+escHtml(dailyTask.hint)+'</div>';

  document.getElementById('btn-daily-submit').style.display = 'none';
  // Обновляем страницу задачи дня после ответа
  buildDailyPage();
}

function dlLocal(r){function esc(t){return String(t).replace(/\\/g,'\\\\').replace(/\{/g,'\\{').replace(/\}/g,'\\}').replace(/[^\x00-\x7E]/g,c=>`\\u${c.charCodeAt(0)}?`);}const mm=String(Math.floor(r.elapsed/60)).padStart(2,'0'),ss=String(r.elapsed%60).padStart(2,'0');const lines=[['T','РЕЗУЛЬТАТЫ — MatriX'],['e',''],['n',`Дата: ${r.date}`],['n',`Ученик: ${r.user.name} ${r.user.surname}`],['n',`Класс: ${r.user.cls}`],['e',''],['n',`Тест: ${r.test.title}`],['e',''],['h','РЕЗУЛЬТАТ:'],['n',`Правильных: ${r.correct} из ${r.total}`],['n',`Оценка: ${r.pct}%`],['n',`Время: ${mm}:${ss}`],['e',''],['h','ОТВЕТЫ:'],['e','']];r.questions.forEach((q,i)=>{const a=r.answers[i]??'—',ok=a===q.correct;lines.push(['n',`Вопрос ${i+1}: ${q.text}`],['n',`  Ответ: ${a}`],['n',`  Верный: ${q.correct}`],[ok?'ok':'err',ok?'  ВЕРНО':'  НЕВЕРНО'],['e','']);});const body=lines.map(([k,t])=>{const e=esc(t);if(k==='T')return`\\b\\fs32 ${e}\\b0\\fs24\\par`;if(k==='h')return`\\b ${e}\\b0\\par`;if(k==='ok')return`\\cf2 ${e}\\cf1\\par`;if(k==='err')return`\\cf3 ${e}\\cf1\\par`;if(k==='e')return'\\par';return`${e}\\par`;}).join('\n');const rtf=`{\\rtf1\\ansi\\deff0\n{\\fonttbl{\\f0 Arial;}}\n{\\colortbl;\\red0\\green0\\blue0;\\red0\\green128\\blue0;\\red200\\green0\\blue0;}\n\\f0\\fs24\n${body}\n}`;const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rtf],{type:'application/rtf'}));a.download=`MatriX_${r.user.surname}.rtf`;a.click();URL.revokeObjectURL(a.href);showToast('Файл скачан!');}


/* ═══════════════════════════════════════════
   SUPERUSER CONSTANTS & STATE
═══════════════════════════════════════════ */
const SUPER_LOGIN = 'admin';
const SUPER_PASS  = 'matrix2026';
let superUser = false;

// Custom tests — in-memory cache, loaded from server
let _customTestsCache = null;
async function loadCustomTests(){
  if(_customTestsCache !== null) return _customTestsCache;
  try{
    const rows = await apiGet('/api/custom-tests');
    _customTestsCache = rows.map(dbTestToFront);
    return _customTestsCache;
  }catch(e){ return []; }
}
function _customTestsCacheInvalidate(){ _customTestsCache = null; }
function dbTestToFront(t){
  return {
    id: t.id,
    title: t.title,
    desc: t.desc||'',
    difficulty: t.difficulty,
    diffLabel: t.diff_label,
    questions: t.questions,
    time: t.time,
    topics: JSON.parse(t.topics||'[]'),
    topicKeys: JSON.parse(t.topic_keys||'[]'),
    topicCounts: JSON.parse(t.topic_counts||'{}'),
    custom: true,
    _dbId: t.id
  };
}

// Control work settings stored in localStorage
function loadCtrlSettings(){
  try{
    const s = JSON.parse(localStorage.getItem('mx_ctrl_settings')||'null');
    return s || {time:60, qcount:15, topics: null};
  }catch(e){ return {time:60, qcount:15, topics:null}; }
}
function saveCtrlSettings(s){
  try{ localStorage.setItem('mx_ctrl_settings', JSON.stringify(s)); }catch(e){}
}

/* ═══════════════════════════════════════════
   LOGIN TAB SWITCHING
═══════════════════════════════════════════ */
function switchLoginTab(tab){
  document.getElementById('tab-student').classList.toggle('active', tab==='student');
  document.getElementById('tab-super').classList.toggle('active', tab==='super');
  document.getElementById('lpanel-student').classList.toggle('active', tab==='student');
  document.getElementById('lpanel-super').classList.toggle('active', tab==='super');
}

/* ═══════════════════════════════════════════
   SUPER LOGIN / LOGOUT
═══════════════════════════════════════════ */
function doSuperLogin(){
  const login = document.getElementById('inp-super-login').value.trim();
  const pass  = document.getElementById('inp-super-pass').value;
  if(login !== SUPER_LOGIN || pass !== SUPER_PASS){
    showToast('Неверный логин или пароль');
    document.getElementById('inp-super-pass').value='';
    return;
  }
  superUser = true;
  document.getElementById('inp-super-pass').value='';
  document.getElementById('inp-super-login').value='';
  showScreen('super');
  superPage('tests');
}
function doSuperLogout(){
  superUser = false;
  showScreen('login');
  switchLoginTab('student');
}

/* ═══════════════════════════════════════════
   SUPER NAVIGATION
═══════════════════════════════════════════ */
let superPanelOpen = true;
let currentSuperPage = 'tests';
let adminStudentsCache = [];
let adminResultsCache = [];
let selectedAdminStudentId = null;
function toggleSuperPanel(){
  superPanelOpen = !superPanelOpen;
  document.getElementById('super-panel-wrapper').classList.toggle('closed', !superPanelOpen);
}

function superPage(name){
  currentSuperPage = name;
  document.querySelectorAll('#screen-super .page').forEach(p=>p.classList.remove('active'));
  document.getElementById('spage-'+name).classList.add('active');
  document.querySelectorAll('#screen-super .panel-btn').forEach(b=>b.classList.remove('active'));
  const nb = document.getElementById('spb-'+name);
  if(nb) nb.classList.add('active');
  if(name==='tests'){ buildSuperViewTestList(); }
  if(name==='typed'){ buildSuperTypedGrid(); }
  if(name==='control'){ _customCtrlsCacheInvalidate(); buildSuperCtrlList(); }
  if(name==='manage'){ buildSuperTestsList(); }
  if(name==='history'){ buildAdminHistory(); }
  // ctrlset merged into control page
}

/* ═══════════════════════════════════════════
   ADMIN: STUDENT HISTORY
═══════════════════════════════════════════ */
async function buildAdminHistory(){
  const list=document.getElementById('admin-students-list');
  const summary=document.getElementById('admin-history-summary');
  if(!list||!summary)return;
  list.innerHTML='<div class="admin-history-empty">Загружаем учеников и результаты...</div>';
  try{
    const [students,results]=await Promise.all([
      apiGet('/api/users/'),
      apiGet('/api/tests/results/all')
    ]);
    adminStudentsCache=students;
    adminResultsCache=results;
    const average=results.length
      ? Math.round(results.reduce((sum,r)=>sum+(Number(r.percentage)||0),0)/results.length)
      : 0;
    summary.innerHTML=`
      <div class="admin-stat"><strong>${students.length}</strong><span>Учеников</span></div>
      <div class="admin-stat"><strong>${results.length}</strong><span>Попыток</span></div>
      <div class="admin-stat"><strong>${average}%</strong><span>Средний результат</span></div>`;
    document.getElementById('admin-student-search').value='';
    document.getElementById('admin-students-view').style.display='';
    document.getElementById('admin-student-detail').style.display='none';
    renderAdminStudents(students);
  }catch(e){
    list.innerHTML='<div class="admin-history-empty">Не удалось загрузить данные. Проверьте подключение к серверу.</div>';
    showToast('Ошибка загрузки истории учеников');
  }
}

function renderAdminStudents(students){
  const list=document.getElementById('admin-students-list');
  if(!students.length){
    list.innerHTML='<div class="admin-history-empty">Ученики пока не зарегистрированы</div>';
    return;
  }
  list.innerHTML=students.map(st=>{
    const attempts=adminResultsCache.filter(r=>r.user_id===st.id);
    const avg=attempts.length?Math.round(attempts.reduce((sum,r)=>sum+(Number(r.percentage)||0),0)/attempts.length):0;
    return `<div class="admin-student-card" onclick="openAdminStudent(${st.id})">
      <div><div class="admin-student-name">${escHtml(st.last_name)} ${escHtml(st.first_name)}</div>
      <div class="admin-student-meta">${escHtml(st.grade||'Класс не указан')} · Средний результат: ${attempts.length?avg+'%':'—'}</div></div>
      <div class="admin-student-count">${attempts.length} ${attempts.length===1?'попытка':(attempts.length>=2&&attempts.length<=4?'попытки':'попыток')} →</div>
    </div>`;
  }).join('');
}

function filterAdminStudents(){
  const query=(document.getElementById('admin-student-search').value||'').trim().toLowerCase();
  const filtered=adminStudentsCache.filter(st=>
    `${st.first_name} ${st.last_name} ${st.grade}`.toLowerCase().includes(query)
  );
  renderAdminStudents(filtered);
}

function openAdminStudent(studentId){
  const st=adminStudentsCache.find(x=>x.id===studentId);
  if(!st)return;
  selectedAdminStudentId=studentId;
  const attempts=adminResultsCache.filter(r=>r.user_id===studentId)
    .sort((a,b)=>new Date(b.timestamp||0)-new Date(a.timestamp||0));
  document.getElementById('admin-students-view').style.display='none';
  document.getElementById('admin-student-detail').style.display='';
  document.getElementById('admin-student-heading').innerHTML=`
    <div class="admin-student-head"><strong>${escHtml(st.last_name)} ${escHtml(st.first_name)}</strong>
    <span>${escHtml(st.grade||'Класс не указан')} · Всего попыток: ${attempts.length}</span></div>`;
  const container=document.getElementById('admin-student-results');
  if(!attempts.length){
    container.innerHTML='<div class="admin-history-empty">У этого ученика пока нет сохранённых результатов</div>';
    return;
  }
  container.innerHTML=attempts.map(r=>{
    const sc=r.percentage>=70?'sg':r.percentage>=50?'sy':'sr';
    const mm=String(Math.floor(r.time_spent/60)).padStart(2,'0');
    const ss=String(r.time_spent%60).padStart(2,'0');
    const date=r.timestamp?new Date(r.timestamp).toLocaleString('ru-RU'):'—';
    return `<div class="hcard"><div><div class="hcard-title">${escHtml(r.test_title)}</div>
      <div class="hcard-meta">${date} · ${r.correct_answers} из ${r.total_questions} верных · ⏱ ${mm}:${ss}</div></div>
      <div class="hcard-right"><div class="hscore ${sc}">${r.percentage}%</div>
      <button class="btn-review" onclick="showReview(${r.id},${studentId})">🔍 Разбор</button>
      <button class="btn-dl" onclick="downloadById(${r.id})">📄 Word</button></div></div>`;
  }).join('');
}

function exportAdminResults(format,userId=null){
  const params=userId!==null&&userId!==undefined?`?user_id=${encodeURIComponent(userId)}`:'';
  window.location.href=`/api/tests/export/${format}${params}`;
  showToast(format==='excel'?'Готовим файл Excel...':'Готовим файл Word...');
}

function backToAdminStudents(){
  selectedAdminStudentId=null;
  document.getElementById('admin-student-detail').style.display='none';
  document.getElementById('admin-students-view').style.display='';
}

async function buildSuperViewTestList(){
  const custom = await loadCustomTests();
  const all = [...TESTS, ...custom];
  const bc={easy:'badge-easy',medium:'badge-medium',hard:'badge-hard'};
  document.getElementById('super-test-list-container').innerHTML = all.map(t=>`
    <div class="test-card">
      <div class="test-card-title">${escHtml(t.title)}${t.custom?'<span class="badge badge-custom" style="font-size:10px;padding:2px 8px;margin-left:8px;vertical-align:middle;">Свой</span>':''}</div>
      <div class="test-card-desc">${escHtml(t.desc||'')}</div>
      <div class="test-card-meta"><span class="badge ${bc[t.difficulty]||'badge-easy'}">${escHtml(t.diffLabel||'')}</span><span class="meta-item">🏆 ${t.questions} вопросов</span><span class="meta-item">🕐 ${t.time} мин</span></div>
      <button class="btn-start" onclick="superOpenTestInfo(${t.id})">▶ Пройти тест</button>
    </div>`).join('');
}

let superSelectedOp = null, superSelectedQty = 5;
function buildSuperTypedGrid(){
  document.getElementById('super-typed-grid').innerHTML = TYPED_OPS.map(op=>`
    <div class="typed-card" id="stc-${op.key}" onclick="selectSuperOp('${op.key}')">
      <div class="typed-card-icon">${op.icon}</div>
      <div class="typed-card-title">${op.title}</div>
      <div class="typed-card-desc">${op.desc}</div>
    </div>`).join('');
  document.getElementById('super-qty-box').style.display='none';
  document.getElementById('super-btn-start-typed').style.display='none';
}
function selectSuperOp(key){
  superSelectedOp=key;
  document.querySelectorAll('#super-typed-grid .typed-card').forEach(c=>c.classList.remove('sel'));
  document.getElementById('stc-'+key).classList.add('sel');
  document.getElementById('super-qty-box').style.display='';
  document.getElementById('super-btn-start-typed').style.display='';
}
function selectSuperQty(n){
  superSelectedQty=n;
  document.querySelectorAll('#super-qty-box .qty-btn').forEach(b=>b.classList.remove('sel'));
  document.getElementById('sqty-'+n).classList.add('sel');
}
function startSuperTypedTest(){
  if(!superSelectedOp){showToast('Выберите операцию!');return;}
  const op=TYPED_OPS.find(o=>o.key===superSelectedOp);
  currentMode='typed'; selectedOperation=superSelectedOp; selectedQty=superSelectedQty;
  currentTestDef={id:200+TYPED_OPS.indexOf(op),title:'Типовые: '+op.title,desc:op.desc,diffLabel:'Типовые',questions:superSelectedQty,time:45,topics:[]};
  openInfo();
}

function buildSuperCtrlPreview(){
  const s = loadCtrlSettings();
  const topics = s.topics || (GRADE_TOPICS[11]);
  const names = topics.map(k=>{const ti=ALL_TOPIC_INFO.find(x=>x.key===k);return ti?ti.icon+' '+ti.title:k;});
  document.getElementById('super-ctrl-preview-card').innerHTML=`
    <div class="test-card-title">Итоговая контрольная работа</div>
    <div class="test-card-desc">Параметры, настроенные администратором</div>
    <div class="test-card-meta">
      <span class="badge badge-ctrl">Контрольная</span>
      <span class="meta-item">📝 ${s.qcount||15} вопросов</span>
      <span class="meta-item">🕐 ${s.time||60} минут</span>
      <span class="meta-item">⭐ Оценка 2–5</span>
    </div>
    <div style="background:var(--g100);border:2px solid var(--g200);border-radius:var(--r);padding:12px 16px;font-size:13px;line-height:1.9;margin-bottom:4px;">
      <b>Темы:</b> ${escHtml(names.join(' · '))}
    </div>`;
}

/* ═══════════════════════════════════════════
   ALL TOPICS INFO (for chips)
═══════════════════════════════════════════ */
const ALL_TOPIC_INFO = [
  {key:'add',       icon:'➕', title:'Сложение матриц'},
  {key:'scalar',    icon:'🔣', title:'Умножение на скаляр'},
  {key:'multiply',  icon:'✖️',  title:'Умножение матриц'},
  {key:'transpose', icon:'↗️',  title:'Транспонирование'},
  {key:'size',      icon:'📏', title:'Размер матрицы'},
  {key:'det2',      icon:'🔢', title:'Определитель 2×2'},
  {key:'det3',      icon:'🔢', title:'Определитель 3×3'},
  {key:'matpow',    icon:'⬆️', title:'Степень матрицы'},
  {key:'inverse',   icon:'🔄', title:'Обратная матрица'},
  {key:'rank',      icon:'📐', title:'Ранг матрицы'},
  {key:'sle',       icon:'⚖️',  title:'Системы уравнений'},
  {key:'minor',     icon:'🔍', title:'Минор и дополнение'},
];

/* ═══════════════════════════════════════════
   SUPER TESTS LIST
═══════════════════════════════════════════ */
async function buildSuperTestsList(){
  const container = document.getElementById('super-tests-list');
  const custom = await loadCustomTests();
  const diff={easy:'Лёгкий',medium:'Средний',hard:'Сложный'};
  const diffC={easy:'badge-easy',medium:'badge-medium',hard:'badge-hard'};

  let html = '';

  // Built-in tests
  html += '<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--g400);margin-bottom:10px;">Встроенные тесты</div>';
  html += TESTS.map(t => `
    <div class="stest-card">
      <div class="stest-card-left">
        <div class="stest-card-title">${escHtml(t.title)} <span class="badge ${diffC[t.difficulty]||'badge-easy'}" style="font-size:10px;padding:2px 8px;">${diff[t.difficulty]||''}</span></div>
        <div class="stest-card-meta">${escHtml(t.desc)} · ${t.questions} вопросов · ${t.time} мин</div>
      </div>
      <div class="stest-card-right"><span style="font-size:12px;color:var(--g400)">Встроенный</span></div>
    </div>`).join('');

  // Custom tests
  if(custom.length){
    html += '<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--g400);margin:20px 0 10px;">Ваши тесты</div>';
    html += custom.map((t,i) => `
      <div class="stest-card custom">
        <div class="stest-card-left">
          <div class="stest-card-title">${escHtml(t.title)} <span class="badge badge-custom" style="font-size:10px;padding:2px 8px;">Свой</span></div>
          <div class="stest-card-meta">${escHtml(t.desc||'')} · ${t.questions} вопр. · ${t.time} мин · Темы: ${(t.topicKeys||[]).map(k=>{const ti=ALL_TOPIC_INFO.find(x=>x.key===k);return ti?ti.icon+' '+ti.title:k;}).join(', ')}</div>
        </div>
        <div class="stest-card-right">
          <button class="btn-edit" onclick="openTestEditor(${i})">✏️ Изменить</button>
          <button class="btn-del"  onclick="deleteCustomTest(${i})">🗑 Удалить</button>
        </div>
      </div>`).join('');
  } else {
    html += '<div style="font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:var(--g400);margin:20px 0 10px;">Ваши тесты</div>';
    html += '<div class="super-empty">Вы ещё не создали ни одного теста 📝<br><span style="font-size:13px">Нажмите «Создать новый тест» выше</span></div>';
  }

  container.innerHTML = html;
}

async function deleteCustomTest(idx){
  const arr = await loadCustomTests();
  if(!confirm('Удалить тест «'+arr[idx].title+'»?')) return;
  const dbId = arr[idx]._dbId || arr[idx].id;
  try{
    await apiDelete('/api/custom-tests/'+dbId);
    _customTestsCacheInvalidate();
    await buildSuperTestsList();
    if(user) await buildAllTestsList();
    showToast('Тест удалён');
  }catch(e){ showToast('Ошибка: '+e.message); }
}

/* ═══════════════════════════════════════════
   TEST EDITOR MODAL
═══════════════════════════════════════════ */
let editorTopicCounts = {}; // key -> count
let editingTestIdx = null;  // null = new, number = editing

async function openTestEditor(idx){
  editingTestIdx = idx;
  const custom = await loadCustomTests();
  const t = idx !== null ? custom[idx] : null;

  document.getElementById('editor-modal-title').textContent = t ? 'Редактировать тест' : 'Новый тест';
  document.getElementById('ed-title').value   = t ? t.title   : '';
  document.getElementById('ed-desc').value    = t ? (t.desc||'') : '';
  document.getElementById('ed-diff').value    = t ? t.difficulty : 'medium';
  document.getElementById('ed-time').value    = t ? t.time    : 15;
  document.getElementById('ed-qcount').value  = t ? t.questions : 5;

  editorTopicCounts = {};
  if(t && t.topicCounts) {
    editorTopicCounts = {...t.topicCounts};
  }

  buildEditorTopicsGrid();
  updateEditorPreview();
  document.getElementById('test-editor-modal').classList.add('open');
}

function closeTestEditor(){
  document.getElementById('test-editor-modal').classList.remove('open');
}

function buildEditorTopicsGrid(){
  const grid = document.getElementById('ed-topics-grid');
  grid.innerHTML = ALL_TOPIC_INFO.map(ti => {
    const cnt = editorTopicCounts[ti.key]||0;
    const sel = cnt > 0;
    return `<div class="topic-chip ${sel?'sel':''}" id="edchip-${ti.key}" onclick="cycleTopicCount('${ti.key}')">
      <span class="topic-chip-icon">${ti.icon}</span>
      <span>${ti.title}</span>
      <span class="topic-count-badge">${cnt||'+'}</span>
    </div>`;
  }).join('');
}

function cycleTopicCount(key){
  const max = 8;
  const cur = editorTopicCounts[key]||0;
  const next = cur >= max ? 0 : cur + 1;
  if(next === 0) delete editorTopicCounts[key];
  else editorTopicCounts[key] = next;

  // update chip
  const chip = document.getElementById('edchip-'+key);
  if(chip){
    chip.classList.toggle('sel', next > 0);
    chip.querySelector('.topic-count-badge').textContent = next > 0 ? next : '+';
  }
  updateEditorPreview();
  // auto-update total question count
  const total = Object.values(editorTopicCounts).reduce((a,b)=>a+b,0);
  if(total > 0) document.getElementById('ed-qcount').value = total;
}

function updateEditorPreview(){
  const total = Object.values(editorTopicCounts).reduce((a,b)=>a+b,0);
  const preview = document.getElementById('ed-preview');
  if(!total){ preview.textContent='Выберите темы выше — отметьте количество вопросов по каждой теме'; return; }
  const parts = Object.entries(editorTopicCounts).map(([k,c])=>{
    const ti = ALL_TOPIC_INFO.find(x=>x.key===k);
    return ti ? ti.icon+' '+ti.title+': '+c+' вопр.' : k+': '+c;
  });
  preview.innerHTML = '<b>Состав теста ('+total+' вопросов):</b><br>' + parts.join(' &nbsp;·&nbsp; ');
}

async function saveTest(){
  const title = document.getElementById('ed-title').value.trim();
  const desc  = document.getElementById('ed-desc').value.trim();
  const diff  = document.getElementById('ed-diff').value;
  const time  = parseInt(document.getElementById('ed-time').value)||15;

  if(!title){ showToast('Введите название теста!'); return; }
  const total = Object.values(editorTopicCounts).reduce((a,b)=>a+b,0);
  if(!total){ showToast('Выберите хотя бы одну тему!'); return; }

  const topicKeys = Object.keys(editorTopicCounts);
  const topics = [];
  for(const [k,c] of Object.entries(editorTopicCounts))
    for(let i=0;i<c;i++) topics.push(k);

  const diffLabel = {easy:'Лёгкий',medium:'Средний',hard:'Сложный'}[diff]||'Средний';
  const payload = {
    title, desc, difficulty: diff, diff_label: diffLabel,
    questions: total, time,
    topics: JSON.stringify(topics),
    topic_keys: JSON.stringify(topicKeys),
    topic_counts: JSON.stringify(editorTopicCounts)
  };

  try{
    const arr = await loadCustomTests();
    if(editingTestIdx !== null){
      const dbId = arr[editingTestIdx]._dbId || arr[editingTestIdx].id;
      await apiPut('/api/custom-tests/'+dbId, payload);
    } else {
      await apiPost('/api/custom-tests', payload);
    }
    _customTestsCacheInvalidate();
    closeTestEditor();
    await buildSuperTestsList();
    await buildSuperViewTestList();
    if(user) await buildAllTestsList();
    showToast(editingTestIdx!==null ? 'Тест обновлён ✓' : 'Тест создан ✓');
  }catch(e){ showToast('Ошибка: '+e.message); }
}

/* ═══════════════════════════════════════════
   CONTROL WORK SETTINGS
═══════════════════════════════════════════ */
let ctrlTopicSel = {}; // key -> bool

function buildCtrlTopicsGrid(){
  const settings = loadCtrlSettings();
  // init selection from saved topics or all available
  ctrlTopicSel = {};
  const saved = settings.topics;
  ALL_TOPIC_INFO.forEach(ti => {
    ctrlTopicSel[ti.key] = saved ? saved.includes(ti.key) : true;
  });

  document.getElementById('ctrl-time').value   = settings.time  || 60;
  document.getElementById('ctrl-qcount').value = settings.qcount|| 15;

  const grid = document.getElementById('ctrl-topics-grid');
  grid.innerHTML = ALL_TOPIC_INFO.map(ti => `
    <div class="topic-chip ${ctrlTopicSel[ti.key]?'sel':''}" id="ctrlchip-${ti.key}" onclick="toggleCtrlTopic('${ti.key}')">
      <span class="topic-chip-icon">${ti.icon}</span>
      <span>${ti.title}</span>
    </div>`).join('');
}

function toggleCtrlTopic(key){
  ctrlTopicSel[key] = !ctrlTopicSel[key];
  const chip = document.getElementById('ctrlchip-'+key);
  if(chip) chip.classList.toggle('sel', ctrlTopicSel[key]);
  loadCtrlPreview();
}

function loadCtrlPreview(){
  const sel = Object.entries(ctrlTopicSel).filter(([,v])=>v).map(([k])=>k);
  const q = parseInt(document.getElementById('ctrl-qcount').value)||15;
  const t = parseInt(document.getElementById('ctrl-time').value)||60;
  const prev = document.getElementById('ctrl-preview');
  if(!sel.length){ prev.textContent='Выберите хотя бы одну тему'; return; }
  const names = sel.map(k=>{const ti=ALL_TOPIC_INFO.find(x=>x.key===k);return ti?ti.icon+' '+ti.title:k;});
  prev.innerHTML = '<b>Параметры контрольной:</b> '+q+' вопросов, '+t+' минут<br>Темы: '+names.join(' · ');
}

function saveControlSettings(){
  const sel = Object.entries(ctrlTopicSel).filter(([,v])=>v).map(([k])=>k);
  if(!sel.length){ showToast('Выберите хотя бы одну тему!'); return; }
  const q = parseInt(document.getElementById('ctrl-qcount').value)||15;
  const t = parseInt(document.getElementById('ctrl-time').value)||60;
  saveCtrlSettings({time:t, qcount:q, topics:sel});
  showToast('Настройки контрольной сохранены ✓');
}

function resetControlSettings(){
  saveCtrlSettings({time:60, qcount:15, topics:null});
  buildCtrlTopicsGrid();
  loadCtrlPreview();
  showToast('Настройки сброшены к умолчанию');
}

/* ═══════════════════════════════════════════
   PATCH: buildTestList — include custom tests
═══════════════════════════════════════════ */
async function buildAllTestsList(){
  const custom = await loadCustomTests();
  const all = [...TESTS, ...custom];
  const bc={easy:'badge-easy',medium:'badge-medium',hard:'badge-hard'};
  document.getElementById('test-list-container').innerHTML=all.map(t=>`
    <div class="test-card">
      <div class="test-card-title">${escHtml(t.title)}</div>
      <div class="test-card-desc">${escHtml(t.desc||'')}</div>
      <div class="test-card-meta"><span class="badge ${bc[t.difficulty]||'badge-easy'}">${escHtml(t.diffLabel||'')}</span><span class="meta-item">🏆 ${t.questions} вопросов</span><span class="meta-item">🕐 ${t.time} мин</span></div>
      <button class="btn-start" onclick="openTestInfo(${t.id})">Начать тест</button>
    </div>`).join('');
}

/* ═══════════════════════════════════════════
   PATCH: startControlWork — use saved settings
═══════════════════════════════════════════ */

async function startCustomCtrlWork(idx){
  const arr = await loadCustomCtrls();
  const c = arr[idx];
  if(!c){ showToast('Контрольная не найдена'); return; }
  currentMode = 'control';
  currentTestDef = {
    id: c.id,
    title: c.title,
    desc: c.desc||'',
    diffLabel: 'Контрольная',
    questions: c.qcount,
    time: c.time,
    topics: shuf([...c.topics])
  };
  openInfo();
}

function startControlWorkPatched(){
  const settings = loadCtrlSettings();
  const qcount = settings.qcount || 15;
  const time   = settings.time   || 60;
  const savedTopics = settings.topics;

  const avail = savedTopics || (GRADE_TOPICS[userGrade()]||GRADE_TOPICS[9]);
  const pool = shuf([...avail,...avail,...avail]);
  const total = Math.min(qcount, pool.length * 3);

  currentMode='control';
  currentTestDef={id:999,title:'Контрольная работа',desc:'Проверка знаний по всем операциям',diffLabel:'Контрольная',questions:total,time,topics:shuf(pool).slice(0,total)};
  openInfo();
}

/* ═══════════════════════════════════════════
   SUPER: test launch helpers
═══════════════════════════════════════════ */
async function superOpenTestInfo(id){
  currentMode='test';
  const custom=await loadCustomTests();
  const all=[...TESTS,...custom];
  currentTestDef=all.find(t=>t.id===id);
  openInfo(); // sets launchScreen='super'
}

function startSuperControlWork(){
  const settings = loadCtrlSettings();
  const qcount = settings.qcount || 15;
  const time   = settings.time   || 60;
  const savedTopics = settings.topics;
  const avail = savedTopics || Object.keys(CG);
  const pool = shuf([...avail,...avail,...avail]);
  const total = Math.min(qcount, pool.length * 3);
  currentMode='control';
  currentTestDef={id:999,title:'Контрольная работа',desc:'Проверка знаний по всем операциям',diffLabel:'Контрольная',questions:total,time,topics:shuf(pool).slice(0,total)};
  openInfo(); // sets launchScreen='super'
}

function returnFromResult(){
  if(launchScreen==='super'){
    showScreen('super');
    superPage(currentSuperPage||'tests');
  } else {
    showScreen('main');
  }
}

/* finishTest patch for admin: skip API save */
async function finishTest(timeout){
  clearInterval(timerInterval);
  const elapsed=Math.floor((Date.now()-testStartTime)/1000);
  let correct=0;currentQuestions.forEach((q,i)=>{if(currentAnswers[i]===q.correct)correct++;});
  const tot=currentQuestions.length,pct=Math.round(correct/tot*100);
  const mm=String(Math.floor(elapsed/60)).padStart(2,'0'),ss=String(elapsed%60).padStart(2,'0');
  document.getElementById('res-test-name').textContent=currentTestDef.title;
  document.getElementById('res-percent').textContent=pct+'%';
  document.getElementById('res-correct').textContent=`Правильных: ${correct} из ${tot}`;
  document.getElementById('res-time').textContent=`Затрачено: ${mm}:${ss}`;
  const gEl=document.getElementById('res-grade');
  if(currentMode==='control'){const g=grade(pct);gEl.style.display='';gEl.textContent=`Оценка: ${g}`;gEl.style.color=GCOL[g];document.getElementById('res-icon').textContent=GEMO[g];}
  else{gEl.style.display='none';document.getElementById('res-icon').textContent='✅';}
  let comment=pct>=90?'Отличный результат! 🎉':pct>=70?'Хороший результат! 👍':pct>=50?'Неплохо, есть куда расти 📚':'Нужно повторить материал 📖';
  if(timeout)comment='Время вышло! '+comment;
  document.getElementById('res-comment').textContent=comment;
  const wb=document.getElementById('btn-word');
  showScreen('result');
  mascotReactToFinalResult(pct);

  if(superUser){
    // Admin: skip API, just show result without saving
    wb.style.display='none';
    return;
  }
  wb.style.display='';
  wb.disabled=true;wb.innerHTML='<span class="spinner spinner-dark"></span> Сохранение...';
  const detailed=currentQuestions.map((q,i)=>({question:q.text,user_answer:currentAnswers[i]??'(не отвечено)',correct_answer:q.correct,is_correct:currentAnswers[i]===q.correct}));
  try{const saved=await apiPost('/api/tests/results',{user_id:user.id,test_id:currentTestDef.id,test_title:currentTestDef.title,total_questions:tot,correct_answers:correct,percentage:pct,time_spent:elapsed,detailed_results:JSON.stringify(detailed)});lastResultId=saved.id;wb.disabled=false;wb.innerHTML='📄 Результаты в Word';}
  catch(e){showToast('Результат не сохранён');wb.disabled=false;wb.innerHTML='📄 Результаты в Word';window._localResult={user,test:currentTestDef,mode:currentMode,questions:currentQuestions,answers:{...currentAnswers},correct,total:tot,pct,elapsed,date:new Date().toLocaleString('ru-RU')};}
}


/* ═══════════════════════════════════════════
   CUSTOM CTRL WORKS — storage helpers
═══════════════════════════════════════════ */
let _customCtrlsCache = null;
async function loadCustomCtrls(){
  if(_customCtrlsCache !== null) return _customCtrlsCache;
  try{
    const rows = await apiGet('/api/ctrl-works');
    _customCtrlsCache = rows.map(dbCtrlToFront);
    return _customCtrlsCache;
  }catch(e){ return []; }
}
function _customCtrlsCacheInvalidate(){ _customCtrlsCache = null; }
function dbCtrlToFront(c){
  const d = c.created_at ? new Date(c.created_at).toLocaleDateString('ru-RU') : '—';
  return {
    id: c.id,
    title: c.title,
    desc: c.desc||'',
    grade: c.grade||'',
    qcount: c.qcount,
    time: c.time,
    topics: JSON.parse(c.topics||'[]'),
    topicKeys: JSON.parse(c.topic_keys||'[]'),
    topicCounts: JSON.parse(c.topic_counts||'{}'),
    active: c.active,
    createdAt: d,
    _dbId: c.id
  };
}

/* ── editor state ── */
let ceTopicCounts = {};
let editingCtrlIdx = null;

async function openCtrlEditor(idx){
  editingCtrlIdx = idx;
  const arr = await loadCustomCtrls();
  const c = idx !== null ? arr[idx] : null;

  document.getElementById('ctrl-editor-title').textContent = c ? 'Редактировать контрольную' : 'Новая контрольная работа';
  document.getElementById('ce-title').value  = c ? c.title  : '';
  document.getElementById('ce-desc').value   = c ? (c.desc||'')  : '';
  document.getElementById('ce-grade').value  = c ? (c.grade||'') : '';
  document.getElementById('ce-time').value   = c ? c.time   : 45;
  document.getElementById('ce-qcount').value = c ? c.qcount : 10;

  ceTopicCounts = c && c.topicCounts ? {...c.topicCounts} : {};
  buildCeTopicsGrid();
  updateCePreview();
  document.getElementById('ctrl-editor-modal').classList.add('open');
}

function closeCtrlEditor(){
  document.getElementById('ctrl-editor-modal').classList.remove('open');
}

function buildCeTopicsGrid(){
  const grid = document.getElementById('ce-topics-grid');
  grid.innerHTML = ALL_TOPIC_INFO.map(ti => {
    const cnt = ceTopicCounts[ti.key]||0;
    return `<div class="topic-chip ${cnt>0?'sel':''}" id="cechip-${ti.key}" onclick="cycleCtrlTopicCount('${ti.key}')">
      <span class="topic-chip-icon">${ti.icon}</span>
      <span>${ti.title}</span>
      <span class="topic-count-badge">${cnt||'+'}</span>
    </div>`;
  }).join('');
}

function cycleCtrlTopicCount(key){
  const max = 10;
  const cur = ceTopicCounts[key]||0;
  const next = cur >= max ? 0 : cur + 1;
  if(next === 0) delete ceTopicCounts[key];
  else ceTopicCounts[key] = next;
  const chip = document.getElementById('cechip-'+key);
  if(chip){
    chip.classList.toggle('sel', next > 0);
    chip.querySelector('.topic-count-badge').textContent = next > 0 ? next : '+';
  }
  updateCePreview();
  const total = Object.values(ceTopicCounts).reduce((a,b)=>a+b,0);
  if(total > 0) document.getElementById('ce-qcount').value = total;
}

function updateCePreview(){
  const total = Object.values(ceTopicCounts).reduce((a,b)=>a+b,0);
  const prev = document.getElementById('ce-preview');
  if(!total){ prev.textContent='Выберите темы выше — отметьте количество вопросов'; return; }
  const parts = Object.entries(ceTopicCounts).map(([k,c])=>{
    const ti = ALL_TOPIC_INFO.find(x=>x.key===k);
    return ti ? ti.icon+' '+ti.title+': '+c+' вопр.' : k+': '+c;
  });
  prev.innerHTML = '<b>Состав ('+ total +' вопросов):</b> '+parts.join(' &nbsp;·&nbsp; ');
}

async function saveCtrlWork(){
  const title  = document.getElementById('ce-title').value.trim();
  const desc   = document.getElementById('ce-desc').value.trim();
  const grade  = document.getElementById('ce-grade').value;
  const time   = parseInt(document.getElementById('ce-time').value)||45;

  if(!title){ showToast('Введите название контрольной!'); return; }
  const total = Object.values(ceTopicCounts).reduce((a,b)=>a+b,0);
  if(!total){ showToast('Выберите хотя бы одну тему!'); return; }

  const topicKeys = Object.keys(ceTopicCounts);
  const topics = [];
  for(const [k,c] of Object.entries(ceTopicCounts))
    for(let i=0;i<c;i++) topics.push(k);

  const payload = {
    title, desc, grade,
    qcount: total, time,
    topics: JSON.stringify(topics),
    topic_keys: JSON.stringify(topicKeys),
    topic_counts: JSON.stringify(ceTopicCounts),
    active: true
  };

  try{
    const arr = await loadCustomCtrls();
    if(editingCtrlIdx !== null){
      const dbId = arr[editingCtrlIdx]._dbId || arr[editingCtrlIdx].id;
      await apiPut('/api/ctrl-works/'+dbId, payload);
    } else {
      await apiPost('/api/ctrl-works', payload);
    }
    _customCtrlsCacheInvalidate();
    closeCtrlEditor();
    await buildSuperCtrlList();
    await buildStudentCtrlPage();
    showToast(editingCtrlIdx!==null ? 'Контрольная обновлена ✓' : 'Контрольная создана ✓');
  }catch(e){ showToast('Ошибка: '+e.message); }
}

async function deleteCtrlWork(idx){
  const arr = await loadCustomCtrls();
  if(!confirm('Удалить контрольную «'+arr[idx].title+'»?')) return;
  const dbId = arr[idx]._dbId || arr[idx].id;
  try{
    await apiDelete('/api/ctrl-works/'+dbId);
    _customCtrlsCacheInvalidate();
    await buildSuperCtrlList();
    await buildStudentCtrlPage();
    showToast('Контрольная удалена');
  }catch(e){ showToast('Ошибка: '+e.message); }
}

async function toggleCtrlActive(idx){
  const arr = await loadCustomCtrls();
  const dbId = arr[idx]._dbId || arr[idx].id;
  try{
    const updated = await apiPatch('/api/ctrl-works/'+dbId+'/toggle');
    _customCtrlsCacheInvalidate();
    await buildSuperCtrlList();
    await buildStudentCtrlPage();
    showToast(updated.active ? 'Контрольная активирована' : 'Контрольная скрыта от учеников');
  }catch(e){ showToast('Ошибка: '+e.message); }
}

/* ── build admin list ── */
async function buildSuperCtrlList(){
  const arr = await loadCustomCtrls();
  const container = document.getElementById('super-ctrl-list');
  if(!arr.length){
    container.innerHTML = '<div class="super-empty">Вы ещё не создали ни одной контрольной 📝<br><span style="font-size:13px">Нажмите «Создать контрольную работу» выше</span></div>';
    return;
  }
  container.innerHTML = arr.map((c,i)=>{
    const topicNames = (c.topicKeys||[]).map(k=>{const ti=ALL_TOPIC_INFO.find(x=>x.key===k);return ti?ti.icon+' '+ti.title:k;}).join(', ');
    const gradeLabel = c.grade ? c.grade+' класс' : 'Все классы';
    return `<div class="ctrl-work-card" style="${c.active?'':'opacity:.6;border-style:dashed'}">
      <div class="ctrl-work-card-header">
        <div>
          <div class="ctrl-work-card-title">${escHtml(c.title)}</div>
          ${c.desc?`<div class="ctrl-work-card-desc">${escHtml(c.desc)}</div>`:''}
        </div>
        <span class="badge ${c.active?'badge-ctrl':'badge-builtin'}" style="white-space:nowrap;flex-shrink:0">${c.active?'✅ Активна':'⏸ Скрыта'}</span>
      </div>
      <div class="ctrl-work-card-meta">
        <span class="meta-item">📝 ${c.qcount} вопросов</span>
        <span class="meta-item">🕐 ${c.time} мин</span>
        <span class="meta-item">🎓 ${gradeLabel}</span>
        <span class="meta-item">📅 ${c.createdAt||'—'}</span>
      </div>
      <div class="ctrl-work-card-topics"><b>Темы:</b> ${escHtml(topicNames||'—')}</div>
      <div class="ctrl-work-card-actions">
        <button class="btn-edit" onclick="openCtrlEditor(${i})">✏️ Изменить</button>
        <button class="btn-edit" onclick="toggleCtrlActive(${i})" style="border-color:${c.active?'#fca5a5':'#86efac'};color:${c.active?'#991b1b':'#166534'}">${c.active?'⏸ Скрыть от учеников':'✅ Показать ученикам'}</button>
        <button class="btn-del"  onclick="deleteCtrlWork(${i})">🗑 Удалить</button>
      </div>
    </div>`;
  }).join('');
}

