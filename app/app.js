const fmt = n => new Intl.NumberFormat('fr-FR').format(Math.round(n||0)) + ' FCFA';
const fmtN = n => new Intl.NumberFormat('fr-FR').format(Math.round(n||0));
let DB = {recettes:[], depenses:[], prets:[], echeances:[], projets:[], detailCouts:[], budgetAsc:{}, projetsBase:[]};
let YEAR = 'toutes';
let BASE = null; // données figées de data.json

async function load(){
  BASE = await fetch('data.json').then(r=>r.json());
  refreshFromStorage();
  const pd=document.getElementById('pageDate');
  if(pd) pd.textContent='état au '+new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
  buildYears();
  renderAll();
}

function refreshFromStorage(){
  const extra = k => JSON.parse(localStorage.getItem('fti_'+k)||'[]');
  DB.recettes = [
    ...BASE.recettes.map((r,i)=>({...r, id:'base-r-'+i, fromBase:true, projet: guessProjet(r), produit: guessProduit(r), annee: yearOf(r.date)})),
    ...extra('recettes').map((r,i)=>({...r, id:'extra-r-'+i, fromBase:false, annee: yearOf(r.date)}))
  ];
  DB.depenses = [
    ...BASE.depenses.map((d,i)=>({...d, id:'base-d-'+i, fromBase:true, projet:'PROJET ASC', annee: yearOf(d.date)})),
    ...extra('depenses').map((d,i)=>({...d, id:'extra-d-'+i, fromBase:false, annee: yearOf(d.date)}))
  ];
  DB.detailCouts = BASE.detail_couts || [];
  DB.budgetAsc = BASE.budget_asc || {};
  DB.prets = extra('prets');
  DB.echeances = extra('echeances');
  DB.projetsBase = [
    {nom:'PROJET ASC — Lot 2 (347,5 km)', client:"Maître d'ouvrage ASC / SBEE", contrat:37000000, budget:13104401.625, statut:'En cours'},
    {nom:'PROJET FORET', client:'DISTRICTECH', contrat:null, budget:null, statut:'En cours'},
    {nom:'LEVE', client:'Divers', contrat:null, budget:null, statut:'En cours'},
    {nom:'LOCATION APPAREILS', client:'Divers', contrat:null, budget:null, statut:'Récurrent'},
  ];
  DB.projetsPerso = extra('projets');
}

function yearOf(d){ if(!d) return 'Sans date'; const m=/^(\d{4})/.exec(String(d)); return m?m[1]:'Sans date'; }
function monthOf(d){ if(!d) return null; const m=/^(\d{4}-\d{2})/.exec(String(d)); return m?m[1]:null; }
function guessProjet(r){
  const c=(r.categorie||'')+' '+(r.description||'');
  if(/FORET/i.test(c)) return 'PROJET FORET';
  if(/LEVE/i.test(c)) return 'LEVE';
  if(/LOCATION/i.test(c)) return 'LOCATION APPAREILS';
  return 'LOCATION APPAREILS';
}
function guessProduit(r){ return (r.description||r.categorie||'Produit').trim(); }
function filtered(list){ return YEAR==='toutes'?list:list.filter(x=>String(x.annee)===String(YEAR)); }
function totals(){
  const rec=filtered(DB.recettes), dep=filtered(DB.depenses);
  const tin=rec.reduce((s,x)=>s+Number(x.montant||0),0), tou=dep.reduce((s,x)=>s+Number(x.montant||0),0);
  const restePrets = DB.echeances.filter(e=>!e.paye).reduce((s,e)=>s+Number(e.montant||0),0);
  return {tin,tou,trezo:tin-tou,rec,dep,restePrets};
}
function groupBy(list,key){ const m={}; list.forEach(x=>{const k=x[key]||'—'; m[k]=(m[k]||0)+Number(x.montant||0);}); return m; }

function monthSeries(list){
  const m={}; list.forEach(x=>{const k=monthOf(x.date); if(k) m[k]=(m[k]||0)+Number(x.montant||0);});
  return Object.keys(m).sort().map(k=>m[k]);
}
function sparkSVG(values,color,fill){
  if(!values.length) values=[0];
  const W=120,H=34,max=Math.max(...values,1),min=Math.min(...values,0);
  const pts=values.map((v,i)=>`${(i/(Math.max(1,values.length-1))* (W-4)+2).toFixed(1)},${(H-4-(v-min)/(max-min||1)*(H-8)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polygon points="2,${H-2} ${pts} ${W-2},${H-2}" fill="${fill}"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function cumul(values){ let s=0; return values.map(v=>s+=v); }

function gaugeSVG(pct){
  const p=Math.max(0,Math.min(1,pct)), R=80, C=Math.PI*R, off=C*(1-p);
  const col = p>=0.7 ? '#2E9E66' : p>=0.4 ? '#2F5CE6' : '#D8930D';
  return `<svg viewBox="0 0 200 115"><path d="M20 105 A80 80 0 0 1 180 105" fill="none" stroke="#E7EBF2" stroke-width="16" stroke-linecap="round"/><path d="M20 105 A80 80 0 0 1 180 105" fill="none" stroke="${col}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/><text x="100" y="88" text-anchor="middle" font-size="26" font-weight="800" fill="#141C2E">${(p*100).toFixed(1).replace('.',',')}%</text><text x="100" y="105" text-anchor="middle" font-size="10" fill="#5C6B82">des entrées</text></svg>`;
}

let charts={};
function renderAll(){
  const t=totals();
  const depAsc = DB.depenses.filter(d=>(d.projet||'').includes('ASC')).reduce((s,x)=>s+Number(x.montant||0),0);
  const budget = 13104401.625;
  const inForet = t.rec.filter(r=>r.projet==='PROJET FORET').reduce((s,x)=>s+Number(x.montant||0),0);

  document.getElementById('kpiTréso').textContent=fmt(t.trezo);
  document.getElementById('kpiTrésoPill').textContent=`${t.rec.length} entrées · ${t.dep.length} dépenses`;
  document.getElementById('kpiTrésoSub').textContent=`Période : ${YEAR}`;
  document.getElementById('kpiIn').textContent=fmt(t.tin);
  document.getElementById('kpiInPill').textContent=`dont FORET ${fmt(inForet)}`;
  document.getElementById('kpiInSub').textContent=`Mix : ${[...new Set(t.rec.map(r=>r.produit))].length} produits`;
  document.getElementById('kpiOut').textContent=fmt(t.tou);
  document.getElementById('kpiOutPill').textContent=`${t.tin?(t.tou/t.tin*100).toFixed(1).replace('.',','):0} % des entrées`;
  document.getElementById('kpiOutSub').textContent=`dont ASC ${fmt(depAsc)}`;
  document.getElementById('kpiAscReste').textContent=fmt(budget-depAsc);
  document.getElementById('kpiAscPill').textContent=`${(depAsc/budget*100).toFixed(1).replace('.',',')} % consommé`;
  document.getElementById('sideAscBar').style.width=(depAsc/budget*100).toFixed(1)+'%';
  document.getElementById('sideAscTxt').textContent=`${(depAsc/budget*100).toFixed(1).replace('.',',')} % du budget consommé · reste ${fmt(budget-depAsc)}`;

  const msIn=monthSeries(t.rec), msOut=monthSeries(t.dep);
  const keys=[...new Set([...t.rec.map(r=>monthOf(r.date)),...t.dep.map(r=>monthOf(r.date))])].filter(Boolean).sort();
  const netByMonth=keys.map(k=> (t.rec.filter(r=>monthOf(r.date)===k).reduce((s,x)=>s+Number(x.montant||0),0) - t.dep.filter(r=>monthOf(r.date)===k).reduce((s,x)=>s+Number(x.montant||0),0)));
  document.getElementById('sparkTrezo').innerHTML=sparkSVG(cumul(netByMonth),'#2F5CE6','#EDF2FE');
  document.getElementById('sparkIn').innerHTML=sparkSVG(cumul(msIn),'#2E9E66','#E5F5EC');
  document.getElementById('sparkOut').innerHTML=sparkSVG(cumul(msOut),'#D9584C','#FBEDEB');
  document.getElementById('sparkAsc').innerHTML=sparkSVG(cumul(monthSeries(DB.depenses.filter(d=>(d.projet||'').includes('ASC')))),'#D8930D','#FCF3E0');
  document.getElementById('profitTotal').textContent=fmt(t.trezo);

  const maxF=Math.max(t.tin,t.tou,budget-depAsc,1);
  const bar=(label,val,color)=>`<div class="flow-row"><span>${label}</span><span class="bar"><i style="width:${(val/maxF*100).toFixed(1)}%;background:${color}"></i></span><b>${fmt(val)}</b></div>`;
  document.getElementById('flowBars').innerHTML=
    bar('Entrées',t.tin,'#2E9E66')+bar('Dépenses',t.tou,'#D9584C')+bar('Reste ASC',budget-depAsc,'#2F5CE6');

  document.getElementById('gauge').innerHTML=gaugeSVG(t.tin?inForet/t.tin:0);

  document.getElementById('assistantTxt').textContent = depAsc/budget<0.05
    ? `Démarrage ASC : seulement ${(depAsc/budget*100).toFixed(1).replace('.',',')} % du budget consommé. Point à sécuriser : devis pick-up à 35 000 FCFA/j toujours provisoire.`
    : `Budget ASC consommé à ${(depAsc/budget*100).toFixed(1).replace('.',',')} %. Trésorerie : ${fmt(t.trezo)}.`;

  document.getElementById('alerts').innerHTML = [
    `<li><b>Devise CHF dans l'Excel d'origine</b> → application forcée en FCFA. TVA à paramétrer au Bénin.</li>`,
    `<li><b>Location pick-up 35 000 FCFA/j</b> provisoire (3 080 000 au budget) — à confirmer par devis, c'est le plus gros risque.</li>`,
    `<li><b>KMZ 276,6 km / 347,5 km</b> — 70,9 km manquants, mobilité = enveloppe, pas relevé GPS définitif.</li>`,
    `<li><b>Contrat ASC 37 M non encaissé</b> dans la compta — seules quelques dépenses ASC saisies.</li>`,
    `<li><b>Comptes parfois non renseignés</b> — privilégiez banque / Mobile Money pour une trésorerie réelle.</li>`,
    `<li><b>Stockage local</b> — les ajouts manuels sont dans ce navigateur uniquement. Exportez régulièrement en CSV.</li>`
  ].join('');

  const gp=groupBy(t.rec,'produit');
  document.querySelector('#tblTop tbody').innerHTML = Object.entries(gp).sort((a,b)=>b[1]-a[1]).map(([k,v],i)=>{
    const n=t.rec.filter(r=>r.produit===k).length, pct=(v/Math.max(1,t.tin)*100);
    return `<tr><td><span class="rank">${i+1}</span></td><td><b>${escapeHtml(k)}</b></td><td>${n}</td><td class="mono"><b>${fmt(v)}</b></td><td><div style="display:flex;align-items:center;gap:8px"><span class="share-bar" style="flex:1"><i style="width:${pct.toFixed(1)}%"></i></span><span class="mono">${pct.toFixed(1).replace('.',',')}%</span></div></td></tr>`;
  }).join('');

  renderTables(t); renderCharts(t,keys); renderPrets();
}

function escapeHtml(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function renderCharts(t,keys){
  Object.values(charts).forEach(c=>c&&c.destroy()); charts={};
  if(typeof Chart==='undefined') return;
  Chart.defaults.font.family='Plus Jakarta Sans,sans-serif';
  Chart.defaults.font.size=11;
  const inM=keys.map(k=>t.rec.filter(r=>monthOf(r.date)===k).reduce((s,x)=>s+Number(x.montant||0),0));
  const outM=keys.map(k=>t.dep.filter(r=>monthOf(r.date)===k).reduce((s,x)=>s+Number(x.montant||0),0));
  charts.profit=new Chart(document.getElementById('chProfit'),{type:'line',
    data:{labels:keys.map(k=>k||'—'),datasets:[
      {label:'Entrées cumulées',data:cumul(inM),borderColor:'#2E9E66',backgroundColor:'rgba(46,158,102,.12)',fill:true,tension:.4,pointRadius:3},
      {label:'Dépenses cumulées',data:cumul(outM),borderColor:'#D9584C',backgroundColor:'rgba(217,88,76,.10)',fill:true,tension:.4,pointRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:12,usePointStyle:true}}},scales:{y:{ticks:{callback:v=>fmtN(v)}}}}});
  const cats={};
  t.dep.forEach(d=>{const desc=(d.description||'').toUpperCase(); const k=/RESTAURATION|HOTEL/.test(desc)?'Restauration & hôtel':/ECRAN|CHARGEUR|ONLY|RALONGE|RALLONGE|BUREAUTIQUE/.test(desc)?'Matériel bureau':'Autres'; cats[k]=(cats[k]||0)+Number(d.montant||0);});
  charts.cats=new Chart(document.getElementById('chCats'),{type:'bar',
    data:{labels:Object.keys(cats),datasets:[{data:Object.values(cats),backgroundColor:['#2F5CE6','#D8930D','#6E5BD0'],borderRadius:8,maxBarThickness:48}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>fmtN(v)}}}}});
}

function renderTables(t){
  t=t||totals();
  const allProjs=[...DB.projetsBase, ...DB.projetsPerso];
  const tb=document.querySelector('#tblProjets tbody'); tb.innerHTML='';
  allProjs.forEach((p,pi)=>{
    const isPerso = !!p._perso || DB.projetsPerso.includes(p);
    const ein2 = p.nom==='PROJET FORET'? DB.recettes.filter(r=>r.projet==='PROJET FORET').reduce((s,x)=>s+Number(x.montant||0),0)
      : p.nom==='LEVE'? DB.recettes.filter(r=>r.projet==='LEVE').reduce((s,x)=>s+Number(x.montant||0),0)
      : p.nom==='LOCATION APPAREILS'? DB.recettes.filter(r=>r.projet==='LOCATION APPAREILS').reduce((s,x)=>s+Number(x.montant||0),0)
      : DB.recettes.filter(r=>r.projet===p.nom||(p.nom.includes('ASC')&&(r.projet||'').includes('ASC'))).reduce((s,x)=>s+Number(x.montant||0),0);
    const eout=DB.depenses.filter(d=>d.projet===p.nom||(p.nom.includes('ASC')&&(d.projet||'').includes('ASC'))).reduce((s,x)=>s+Number(x.montant||0),0);
    // Reste à encaisser = contrat − encaissé. Avant : contrat − dépensé,
    // ce qui affichait tout le contrat en « reste » même sans rien encaisser.
    // Sans contrat : solde (encaissé − dépensé).
    const reste = p.contrat ? Math.max(0, p.contrat - ein2) : ein2 - eout;
    const marge = p.contrat? ((p.contrat-(p.budget||eout))/p.contrat*100): null;
    const delBtn = isPerso ? `<button class="btn-icon danger" data-del-projet="${pi - DB.projetsBase.length}" title="Supprimer ce projet" aria-label="Supprimer">×</button>` : '';
    tb.innerHTML+=`<tr><td><b>${escapeHtml(p.nom)}</b><br><span class="muted">${escapeHtml(p.client||'')}</span></td><td>${escapeHtml(p.client||'—')}</td><td class="mono">${p.contrat?fmt(p.contrat):'—'}</td><td class="mono" style="color:var(--accent)">${fmt(ein2)}</td><td class="mono" style="color:var(--danger)">${fmt(eout)}</td><td class="mono"><b>${fmt(reste)}</b></td><td>${marge===null?'—':marge.toFixed(1).replace('.',',')+'%'}</td><td>${escapeHtml(p.statut||'')} ${delBtn}</td></tr>`;
  });
  document.querySelectorAll('[data-del-projet]').forEach(btn=>{
    btn.onclick=()=>{ const idx=+btn.dataset.delProjet; if(confirm('Supprimer ce projet ?')){ const arr=JSON.parse(localStorage.getItem('fti_projets')||'[]'); arr.splice(idx,1); save('projets',arr); refreshFromStorage(); renderAll(); }};
  });

  document.querySelector('#tblBudget tbody').innerHTML = (DB.detailCouts||[]).map(d=>`<tr><td>${escapeHtml(d.poste)}</td><td>${d.qte} ${escapeHtml(d.unite||'')}</td><td>${fmtN(d.pu)}</td><td class="mono">${fmt(d.total)}</td><td>${escapeHtml(d.statut||'')}</td></tr>`).join('');

  const gp=groupBy(filtered(DB.recettes),'produit');
  document.querySelector('#tblProduits tbody').innerHTML = Object.entries(gp).sort((a,b)=>b[1]-a[1]).map(([k,v])=>{const n=filtered(DB.recettes).filter(r=>r.produit===k).length;return `<tr><td>${escapeHtml(k)}</td><td>Topographie</td><td>${n}</td><td class="mono" style="color:var(--accent)">${fmt(v)}</td><td>${(v/Math.max(1,totals().tin)*100).toFixed(1).replace('.',',')}%</td></tr>`}).join('');

  const q=(document.getElementById('topSearch').value||'').toLowerCase();
  const match=r=>((r.client||'')+' '+(r.description||'')+' '+(r.produit||'')+' '+(r.projet||'')).toLowerCase().includes(q);

  document.querySelector('#tblIn tbody').innerHTML = filtered(DB.recettes).filter(match).map(r=>{
    const del = !r.fromBase ? `<button class="btn-icon danger" data-del-recette="${r.id}" title="Supprimer" aria-label="Supprimer">×</button>` : '';
    return `<tr><td>${escapeHtml(r.date||'—')}</td><td>${escapeHtml(r.client||'—')}</td><td>${escapeHtml(r.projet)}</td><td>${escapeHtml(r.produit)}</td><td>${escapeHtml(r.description||'')}</td><td>${escapeHtml(r.compte||'—')}</td><td class="mono" style="color:var(--accent)">${fmt(r.montant)} ${del}</td></tr>`;
  }).join('');
  document.querySelectorAll('[data-del-recette]').forEach(btn=>{
    btn.onclick=()=>{ if(!confirm('Supprimer cette entrée ?')) return;
      const arr=JSON.parse(localStorage.getItem('fti_recettes')||'[]');
      const idx = DB.recettes.filter(x=>!x.fromBase).findIndex(x=>x.id===btn.dataset.delRecette);
      if(idx>=0){ arr.splice(idx,1); save('recettes',arr); refreshFromStorage(); renderAll(); }
    };
  });

  document.querySelector('#tblOut tbody').innerHTML = filtered(DB.depenses).filter(d=>((d.description||'')+' '+(d.categorie||'')+' '+(d.projet||'')).toLowerCase().includes(q)).map(d=>{
    const del = !d.fromBase ? `<button class="btn-icon danger" data-del-depense="${d.id}" title="Supprimer" aria-label="Supprimer">×</button>` : '';
    return `<tr><td>${escapeHtml(d.date||'—')}</td><td>${escapeHtml(d.projet)}</td><td>${escapeHtml(d.categorie||'')}</td><td>${escapeHtml(d.description||'')}</td><td>${escapeHtml(d.compte||'—')}</td><td class="mono" style="color:var(--danger)">${fmt(d.montant)} ${del}</td></tr>`;
  }).join('');
  document.querySelectorAll('[data-del-depense]').forEach(btn=>{
    btn.onclick=()=>{ if(!confirm('Supprimer cette dépense ?')) return;
      const arr=JSON.parse(localStorage.getItem('fti_depenses')||'[]');
      const idx = DB.depenses.filter(x=>!x.fromBase).findIndex(x=>x.id===btn.dataset.delDepense);
      if(idx>=0){ arr.splice(idx,1); save('depenses',arr); refreshFromStorage(); renderAll(); }
    };
  });
}

function renderPrets(){
  const box=document.getElementById('pretsList');
  if(!DB.prets.length){ box.innerHTML=`<p class="muted">Aucun prêt saisi. Ajoutez un prêt bancaire : montant, mensualité, durée → l'application génère l'échéancier et le reste dû.</p>`; }
  else box.innerHTML=DB.prets.map((p,pi)=>{const ech=DB.echeances.filter(e=>e.pret===p.nom); const paye=ech.filter(e=>e.paye).reduce((s,e)=>s+Number(e.montant||0),0); const tot=ech.reduce((s,e)=>s+Number(e.montant||0),0); const pct=tot?paye/tot:0;
    return `<div class="pret"><div class="row-between"><b>${escapeHtml(p.nom)}</b><button class="btn-icon danger" data-del-pret="${pi}" title="Supprimer le prêt">×</button></div> — ${escapeHtml(p.banque)}<br><span class="muted">${fmt(p.montant)} · ${fmt(p.mensualite)}/mois · ${ech.length} mois</span><div class="bar"><i style="width:${pct*100}%"></i></div><span class="mono">Payé ${fmt(paye)} · Reste ${fmt(tot-paye)}</span></div>`;
  }).join('');
  document.querySelectorAll('[data-del-pret]').forEach(btn=>{
    btn.onclick=()=>{ if(!confirm('Supprimer ce prêt et son échéancier ?')) return;
      const idx=+btn.dataset.delPret; const pret=DB.prets[idx];
      const pa=JSON.parse(localStorage.getItem('fti_prets')||'[]'); pa.splice(idx,1); save('prets',pa);
      const ea=JSON.parse(localStorage.getItem('fti_echeances')||'[]').filter(e=>e.pret!==pret.nom); save('echeances',ea);
      refreshFromStorage(); renderAll();
    };
  });
  document.querySelector('#tblEch tbody').innerHTML = DB.echeances.map((e,i)=>`<tr><td>${escapeHtml(e.pret)}</td><td>${escapeHtml(e.date)}</td><td class="mono">${fmt(e.montant)}</td><td><input type="checkbox" data-i="${i}" ${e.paye?'checked':''} class="paye" aria-label="Échéance ${e.date} payée"> ${e.paye?'Payé':'À payer'}</td></tr>`).join('') || `<tr><td colspan="4" class="muted">—</td></tr>`;
  document.querySelectorAll('.paye').forEach(c=>c.onchange=e=>{DB.echeances[+e.target.dataset.i].paye=e.target.checked; save('echeances',DB.echeances); renderAll();});
  const t=totals();
  document.getElementById('kpiPrets').textContent=fmt(t.restePrets);
  document.getElementById('kpiPretsSub').textContent= DB.prets.length? ` · ${DB.prets.length} prêt(s), ${DB.echeances.filter(e=>!e.paye).length} échéances restantes` : ' — ajoutez le 1er prêt';
}

function save(k,v){ localStorage.setItem('fti_'+k, JSON.stringify(v)); }

function buildYears(){
  const ys=[...new Set([...DB.recettes.map(r=>r.annee),...DB.depenses.map(d=>d.annee)])].filter(Boolean).sort();
  const sw=document.getElementById('yearSwitch'); sw.innerHTML='';
  ['toutes',...ys].forEach(y=>{const b=document.createElement('button'); b.textContent=y; if(y===YEAR)b.classList.add('on'); b.onclick=()=>{YEAR=y; buildYears(); renderAll();}; sw.appendChild(b);});
}

function goto(tab){ document.querySelectorAll('.side-nav button').forEach(b=>{const on=b.dataset.tab===tab; b.classList.toggle('active',on); b.setAttribute('aria-selected',on);}); document.querySelectorAll('main .tab').forEach(s=>s.classList.remove('active')); document.getElementById('tab-'+tab).classList.add('active'); }
document.getElementById('tabs').onclick=e=>{ const btn=e.target.closest('button'); if(btn&&btn.dataset.tab) goto(btn.dataset.tab); };
document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>goto(b.dataset.goto));
document.querySelectorAll('[data-goto-alerts]').forEach(b=>b.onclick=()=>{goto('vue'); setTimeout(()=>document.getElementById('alertsCard').scrollIntoView({behavior:'smooth'}),50);});
document.getElementById('topSearch').oninput=()=>renderTables();

/* Export CSV */
function toCSV(rows, headers){
  const esc = v => { const s=String(v??''); return /[",\n;]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s; };
  return [headers.join(';'), ...rows.map(r=>headers.map(h=>esc(r[h])).join(';'))].join('\n');
}
function downloadCSV(filename, content){
  const blob = new Blob(['\uFEFF'+content], {type:'text/csv;charset=utf-8'});
  const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click(); URL.revokeObjectURL(a.href);
}
document.getElementById('btnExportIn')?.addEventListener('click', ()=>{
  const rows = filtered(DB.recettes).map(r=>({date:r.date,client:r.client,projet:r.projet,produit:r.produit,description:r.description,compte:r.compte,montant:r.montant}));
  downloadCSV('fti-entrees.csv', toCSV(rows, ['date','client','projet','produit','description','compte','montant']));
});
document.getElementById('btnExportOut')?.addEventListener('click', ()=>{
  const rows = filtered(DB.depenses).map(d=>({date:d.date,projet:d.projet,categorie:d.categorie,description:d.description,compte:d.compte,montant:d.montant}));
  downloadCSV('fti-depenses.csv', toCSV(rows, ['date','projet','categorie','description','compte','montant']));
});

/* Dialogs */
const dlg=document.getElementById('dlg'), fields=document.getElementById('dlgFields'), title=document.getElementById('dlgTitle');
let onOk=null;
function openDlg(t, html, cb){ title.textContent=t; fields.innerHTML=html; onOk=cb; dlg.showModal(); }
// method="dialog" ferme la fenêtre même quand la validation échoue :
// on annule la fermeture si le callback retourne false (saisie conservée,
// l'utilisateur corrige et reclique Enregistrer).
document.getElementById('dlgForm').addEventListener('submit', (e)=>{ if(e.submitter && e.submitter.value!=='ok'){ onOk=null; return; } if(!onOk) return; const r=onOk(); if(r===false){ e.preventDefault(); } else { onOk=null; } });
const inp=(id,label,val='',type='text')=>`<label>${label}<input id="${id}" type="${type}" value="${val}" ${type==='number'?'min="0" step="1"':''}></label>`;
const sel=(id,label,options,val='')=>`<label>${label}<select id="${id}">${options.map(o=>`<option value="${o}" ${o===val?'selected':''}>${o}</option>`).join('')}</select></label>`;
const COMPTES = ['Espèces (caisse)','Compte bancaire 1','MOMOPAY business','HORS CAISSE'];

document.getElementById('btnAddRecette').onclick=()=>openDlg('Nouvelle entrée d’argent',
  inp('f-date','Date (AAAA-MM-JJ)',new Date().toISOString().slice(0,10))+
  inp('f-client','Client')+
  inp('f-projet','Projet (ex: PROJET FORET, LEVE, PROJET ASC — Lot 2)')+
  inp('f-produit','Produit (ex: LOCATION GPS, LEVE PARCELLE)')+
  inp('f-desc','Description')+
  inp('f-montant','Montant FCFA','', 'number')+
  sel('f-compte','Compte',COMPTES,'Espèces (caisse)'),
  ()=>{
    const g=id=>document.getElementById(id).value;
    const montant = +g('f-montant');
    if(!montant || montant<=0){ alert('Le montant doit être supérieur à 0.'); return false; }
    if(!g('f-date')){ alert('La date est obligatoire.'); return false; }
    const r={date:g('f-date'),client:g('f-client'),projet:g('f-projet')||'Sans projet',produit:g('f-produit')||g('f-desc')||'Produit',description:g('f-desc'),montant,compte:g('f-compte')||'Espèces (caisse)',annee:yearOf(g('f-date')),categorie:''};
    const arr=JSON.parse(localStorage.getItem('fti_recettes')||'[]'); arr.push(r); save('recettes',arr);
    refreshFromStorage(); buildYears(); renderAll();
  }
);

document.getElementById('btnAddDepense').onclick=()=>openDlg('Nouvelle dépense',
  inp('f-date','Date',new Date().toISOString().slice(0,10))+
  inp('f-projet','Projet (ou COUR / SIEGE pour la cour)')+
  inp('f-cat','Catégorie (personnel, carburant, location, hébergement, restauration, matériel, cour…)')+
  inp('f-desc','Description')+
  inp('f-montant','Montant FCFA','', 'number')+
  sel('f-compte','Compte',COMPTES,'Espèces (caisse)'),
  ()=>{
    const g=id=>document.getElementById(id).value;
    const montant = +g('f-montant');
    if(!montant || montant<=0){ alert('Le montant doit être supérieur à 0.'); return false; }
    if(!g('f-date')){ alert('La date est obligatoire.'); return false; }
    const d={date:g('f-date'),projet:g('f-projet')||'COUR / SIEGE',categorie:g('f-cat'),description:g('f-desc'),montant,compte:g('f-compte')||'Espèces (caisse)',annee:yearOf(g('f-date'))};
    const arr=JSON.parse(localStorage.getItem('fti_depenses')||'[]'); arr.push(d); save('depenses',arr);
    refreshFromStorage(); buildYears(); renderAll();
  }
);

document.getElementById('btnAddProjet').onclick=()=>openDlg('Nouveau projet',
  inp('f-nom','Nom projet')+inp('f-client','Client')+inp('f-contrat','Montant contrat FCFA','', 'number'),
  ()=>{
    const g=id=>document.getElementById(id).value;
    if(!g('f-nom').trim()){ alert('Le nom du projet est obligatoire.'); return false; }
    const arr=JSON.parse(localStorage.getItem('fti_projets')||'[]');
    arr.push({nom:g('f-nom').trim(),client:g('f-client'),contrat:+g('f-contrat')||null,budget:null,statut:'Nouveau',_perso:true});
    save('projets',arr); refreshFromStorage(); renderAll();
  }
);

document.getElementById('btnAddPret').onclick=()=>openDlg('Nouveau prêt bancaire',
  inp('f-nom','Nom (ex: Prêt BOA pick-up)')+
  inp('f-banque','Banque')+
  inp('f-montant','Montant total à rembourser','', 'number')+
  inp('f-mens','Mensualité','', 'number')+
  inp('f-nb','Nb mois','12', 'number')+
  inp('f-date','1ère échéance (AAAA-MM-JJ)',new Date().toISOString().slice(0,10)),
  ()=>{
    const g=id=>document.getElementById(id).value;
    const montant=+g('f-montant'), mens=+g('f-mens'), nb=+g('f-nb');
    if(!g('f-nom').trim()){ alert('Le nom du prêt est obligatoire.'); return false; }
    if(!montant||montant<=0||!mens||mens<=0||!nb||nb<=0){ alert('Montant, mensualité et nombre de mois doivent être > 0.'); return false; }
    const pa=JSON.parse(localStorage.getItem('fti_prets')||'[]');
    const ea=JSON.parse(localStorage.getItem('fti_echeances')||'[]');
    pa.push({nom:g('f-nom').trim(),banque:g('f-banque'),montant,mensualite:mens});
    let d=new Date(g('f-date'));
    for(let i=0;i<nb;i++){ ea.push({pret:g('f-nom').trim(),date:d.toISOString().slice(0,10),montant:mens,paye:false}); d.setMonth(d.getMonth()+1); }
    save('prets',pa); save('echeances',ea); refreshFromStorage(); renderAll();
  }
);

load();
if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.body.classList.add('anim');}
