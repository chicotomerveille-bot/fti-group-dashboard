const fmt = n => new Intl.NumberFormat('fr-FR').format(Math.round(n||0)) + ' FCFA';
const fmtN = n => new Intl.NumberFormat('fr-FR').format(Math.round(n||0));
let DB = {recettes:[], depenses:[], prets:[], echeances:[], projets:[]};
let YEAR = 'toutes';

async function load(){
  const base = await fetch('data.json').then(r=>r.json());
  const extra = k => JSON.parse(localStorage.getItem('fti_'+k)||'[]');
  DB.recettes = [...base.recettes.map(r=>({...r, projet: guessProjet(r), produit: guessProduit(r), annee: yearOf(r.date)})), ...extra('recettes')];
  DB.depenses = [...base.depenses.map(d=>({...d, projet:'PROJET ASC', annee: yearOf(d.date)})), ...extra('depenses')];
  DB.detailCouts = base.detail_couts; DB.budgetAsc = base.budget_asc;
  DB.prets = extra('prets'); DB.echeances = extra('echeances');
  DB.projetsBase = [
    {nom:'PROJET ASC — Lot 2 (347,5 km)', client:'Maître d’ouvrage ASC / SBEE', contrat:37000000, budget:13104401.625, statut:'En cours'},
    {nom:'PROJET FORET', client:'DISTRICTECH', contrat:null, budget:null, statut:'En cours'},
    {nom:'LEVE', client:'Divers', contrat:null, budget:null, statut:'En cours'},
    {nom:'LOCATION APPAREILS', client:'Divers', contrat:null, budget:null, statut:'Récurrent'},
  ];
  DB.projetsPerso = extra('projets');
  const pd=document.getElementById('pageDate');
  if(pd) pd.textContent='état au '+new Date().toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'});
  buildYears(); renderAll();
}
function yearOf(d){ if(!d) return 'Sans date'; const m=/^(\d{4})/.exec(d); return m?m[1]:'Sans date'; }
function monthOf(d){ if(!d) return null; const m=/^(\d{4}-\d{2})/.exec(d); return m?m[1]:null; }
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
  const tin=rec.reduce((s,x)=>s+x.montant,0), tou=dep.reduce((s,x)=>s+x.montant,0);
  const restePrets = DB.echeances.filter(e=>!e.paye).reduce((s,e)=>s+e.montant,0);
  return {tin,tou,trezo:tin-tou,rec,dep,restePrets};
}
function groupBy(list,key){ const m={}; list.forEach(x=>{const k=x[key]||'—'; m[k]=(m[k]||0)+x.montant;}); return m; }

/* Sparklines — construites depuis les vraies dates */
function monthSeries(list){
  const m={}; list.forEach(x=>{const k=monthOf(x.date); if(k) m[k]=(m[k]||0)+x.montant;});
  return Object.keys(m).sort().map(k=>m[k]);
}
function sparkSVG(values,color,fill){
  if(!values.length) values=[0];
  const W=120,H=34,max=Math.max(...values,1),min=Math.min(...values,0);
  const pts=values.map((v,i)=>`${(i/(Math.max(1,values.length-1))* (W-4)+2).toFixed(1)},${(H-4-(v-min)/(max-min||1)*(H-8)).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true"><polygon points="2,${H-2} ${pts} ${W-2},${H-2}" fill="${fill}"/><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}
function cumul(values){ let s=0; return values.map(v=>s+=v); }

/* Jauge semi-circulaire */
function gaugeSVG(pct){
  const p=Math.max(0,Math.min(1,pct)), R=80, C=Math.PI*R, off=C*(1-p);
  const col = p>=0.7 ? '#16A34A' : p>=0.4 ? '#1E6FF5' : '#F59E0B';
  return `<svg viewBox="0 0 200 115"><path d="M20 105 A80 80 0 0 1 180 105" fill="none" stroke="#E2E8F0" stroke-width="16" stroke-linecap="round"/><path d="M20 105 A80 80 0 0 1 180 105" fill="none" stroke="${col}" stroke-width="16" stroke-linecap="round" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${off.toFixed(1)}"/><text x="100" y="88" text-anchor="middle" font-size="26" font-weight="800" fill="#0F1F38">${(p*100).toFixed(1).replace('.',',')}%</text><text x="100" y="105" text-anchor="middle" font-size="10" fill="#64748B">des entrées</text></svg>`;
}

let charts={};
function renderAll(){
  const t=totals();
  const depAsc = DB.depenses.filter(d=>d.projet.includes('ASC')).reduce((s,x)=>s+x.montant,0);
  const budget = 13104401.625;
  const inForet = t.rec.filter(r=>r.projet==='PROJET FORET').reduce((s,x)=>s+x.montant,0);

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

  /* Sparklines */
  const msIn=monthSeries(t.rec), msOut=monthSeries(t.dep);
  const keys=[...new Set([...t.rec.map(r=>monthOf(r.date)),...t.dep.map(r=>monthOf(r.date))])].filter(Boolean).sort();
  const netByMonth=keys.map(k=> (t.rec.filter(r=>monthOf(r.date)===k).reduce((s,x)=>s+x.montant,0) - t.dep.filter(r=>monthOf(r.date)===k).reduce((s,x)=>s+x.montant,0)));
  document.getElementById('sparkTrezo').innerHTML=sparkSVG(cumul(netByMonth),'#1E6FF5','#E8F0FE');
  document.getElementById('sparkIn').innerHTML=sparkSVG(cumul(msIn),'#16A34A','#DCFCE7');
  document.getElementById('sparkOut').innerHTML=sparkSVG(cumul(msOut),'#EF4444','#FEE2E2');
  document.getElementById('sparkAsc').innerHTML=sparkSVG(cumul(monthSeries(DB.depenses.filter(d=>d.projet.includes('ASC')))),'#F59E0B','#FEF3C7');
  document.getElementById('profitTotal').textContent=fmt(t.trezo);

  /* Barres de flux */
  const maxF=Math.max(t.tin,t.tou,budget-depAsc,1);
  const bar=(label,val,color)=>`<div class="flow-row"><span>${label}</span><span class="bar"><i style="width:${(val/maxF*100).toFixed(1)}%;background:${color}"></i></span><b>${fmt(val)}</b></div>`;
  document.getElementById('flowBars').innerHTML=
    bar('Entrées',t.tin,'#16A34A')+bar('Dépenses',t.tou,'#EF4444')+bar('Reste ASC',budget-depAsc,'#1E6FF5');

  /* Jauge */
  document.getElementById('gauge').innerHTML=gaugeSVG(t.tin?inForet/t.tin:0);

  /* Assistant */
  document.getElementById('assistantTxt').textContent = depAsc/budget<0.05
    ? `Démarrage ASC : seulement ${(depAsc/budget*100).toFixed(1).replace('.',',')} % du budget consommé. Point à sécuriser : devis pick-up à 35 000 FCFA/j toujours provisoire.`
    : `Budget ASC consommé à ${(depAsc/budget*100).toFixed(1).replace('.',',')} %. Trésorerie : ${fmt(t.trezo)}.`;

  document.getElementById('alerts').innerHTML = [
    `<li><b>Devise CHF dans l'Excel</b> → appli forcée en FCFA. TVA à 0, à paramétrer au Bénin.</li>`,
    `<li><b>Location pick-up 35 000 FCFA/j</b> provisoire (3 080 000 au budget) — à confirmer par devis, c'est ton plus gros risque.</li>`,
    `<li><b>KMZ 276,6 km / 347,5 km</b> — 70,9 km manquants, mobilité = enveloppe, pas relevé GPS définitif.</li>`,
    `<li><b>Contrat ASC 37M non encaissé</b> dans la compta — seuls 270 000 FCFA de dépenses ASC saisies (2% du budget).</li>`,
    `<li><b>Comptes non renseignés</b> — tout passe en Espèces (caisse). Renseigne banque / Mobile Money pour la tréso réelle.</li>`
  ].join('');

  /* Top produits */
  const gp=groupBy(t.rec,'produit');
  document.querySelector('#tblTop tbody').innerHTML = Object.entries(gp).sort((a,b)=>b[1]-a[1]).map(([k,v],i)=>{
    const n=t.rec.filter(r=>r.produit===k).length, pct=(v/Math.max(1,t.tin)*100);
    return `<tr><td><span class="rank">${i+1}</span></td><td><b>${k}</b></td><td>${n}</td><td class="mono"><b>${fmt(v)}</b></td><td><div style="display:flex;align-items:center;gap:8px"><span class="share-bar" style="flex:1"><i style="width:${pct.toFixed(1)}%"></i></span><span class="mono">${pct.toFixed(1).replace('.',',')}%</span></div></td></tr>`;
  }).join('');

  renderTables(t); renderCharts(t,keys); renderPrets();
}

function renderCharts(t,keys){
  Object.values(charts).forEach(c=>c&&c.destroy()); charts={};
  if(typeof Chart==='undefined') return;
  Chart.defaults.font.family='Inter,sans-serif';
  Chart.defaults.font.size=11;
  const inM=keys.map(k=>t.rec.filter(r=>monthOf(r.date)===k).reduce((s,x)=>s+x.montant,0));
  const outM=keys.map(k=>t.dep.filter(r=>monthOf(r.date)===k).reduce((s,x)=>s+x.montant,0));
  let run=0;
  charts.profit=new Chart(document.getElementById('chProfit'),{type:'line',
    data:{labels:keys.map(k=>k||'—'),datasets:[
      {label:'Entrées cumulées',data:cumul(inM),borderColor:'#16A34A',backgroundColor:'rgba(22,163,74,.12)',fill:true,tension:.4,pointRadius:3},
      {label:'Dépenses cumulées',data:cumul(outM),borderColor:'#EF4444',backgroundColor:'rgba(239,68,68,.10)',fill:true,tension:.4,pointRadius:3}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom',labels:{boxWidth:10,padding:12,usePointStyle:true}}},scales:{y:{ticks:{callback:v=>fmtN(v)}}}}});
  void run;
  const cats={};
  t.dep.forEach(d=>{const desc=(d.description||'').toUpperCase(); const k=/RESTAURATION|HOTEL/.test(desc)?'Restauration & hôtel':/ECRAN|CHARGEUR|ONLY|RALONGE|BUREAUTIQUE/.test(desc)?'Matériel bureau':'Autres'; cats[k]=(cats[k]||0)+d.montant;});
  charts.cats=new Chart(document.getElementById('chCats'),{type:'bar',
    data:{labels:Object.keys(cats),datasets:[{data:Object.values(cats),backgroundColor:['#1E6FF5','#F59E0B','#7C3AED'],borderRadius:8,maxBarThickness:48}]},
    options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{y:{ticks:{callback:v=>fmtN(v)}}}}});
}

function renderTables(t){
  t=t||totals();
  const allProjs=[...DB.projetsBase, ...DB.projetsPerso];
  const tb=document.querySelector('#tblProjets tbody'); tb.innerHTML='';
  allProjs.forEach(p=>{
    const ein=DB.recettes.filter(r=>r.projet===p.nom||(p.nom.includes('ASC')&&r.projet.includes('ASC'))).reduce((s,x)=>s+x.montant,0);
    const eout=DB.depenses.filter(d=>d.projet===p.nom||(p.nom.includes('ASC')&&d.projet.includes('ASC'))).reduce((s,x)=>s+x.montant,0);
    const ein2 = p.nom==='PROJET FORET'? DB.recettes.filter(r=>r.projet==='PROJET FORET').reduce((s,x)=>s+x.montant,0)
      : p.nom==='LEVE'? DB.recettes.filter(r=>r.projet==='LEVE').reduce((s,x)=>s+x.montant,0)
      : p.nom==='LOCATION APPAREILS'? DB.recettes.filter(r=>r.projet==='LOCATION APPAREILS').reduce((s,x)=>s+x.montant,0) : ein;
    const ref = p.contrat ?? ein2;
    const reste = ref - eout;
    const marge = p.contrat? ((p.contrat-(p.budget||eout))/p.contrat*100): null;
    tb.innerHTML+=`<tr><td><b>${p.nom}</b><br><span class="muted">${p.client||''}</span></td><td>${p.client||'—'}</td><td class="mono">${p.contrat?fmt(p.contrat):'—'}</td><td class="mono" style="color:var(--accent)">${fmt(ein2||ein)}</td><td class="mono" style="color:var(--danger)">${fmt(eout)}</td><td class="mono"><b>${fmt(reste)}</b></td><td>${marge===null?'—':marge.toFixed(1).replace('.',',')+'%'}</td><td>${p.statut||''}</td></tr>`;
  });
  document.querySelector('#tblBudget tbody').innerHTML = (DB.detailCouts||[]).map(d=>`<tr><td>${d.poste}</td><td>${d.qte} ${d.unite||''}</td><td>${fmtN(d.pu)}</td><td class="mono">${fmt(d.total)}</td><td>${d.statut||''}</td></tr>`).join('');
  const gp=groupBy(filtered(DB.recettes),'produit');
  document.querySelector('#tblProduits tbody').innerHTML = Object.entries(gp).sort((a,b)=>b[1]-a[1]).map(([k,v])=>{const n=filtered(DB.recettes).filter(r=>r.produit===k).length;return `<tr><td>${k}</td><td>Topographie</td><td>${n}</td><td class="mono" style="color:var(--accent)">${fmt(v)}</td><td>${(v/Math.max(1,totals().tin)*100).toFixed(1).replace('.',',')}%</td></tr>`}).join('');
  const q=(document.getElementById('topSearch').value||'').toLowerCase();
  const match=r=>((r.client||'')+' '+(r.description||'')+' '+(r.produit||'')+' '+(r.projet||'')).toLowerCase().includes(q);
  document.querySelector('#tblIn tbody').innerHTML = filtered(DB.recettes).filter(match).map(r=>`<tr><td>${r.date||'—'}</td><td>${r.client||'—'}</td><td>${r.projet}</td><td>${r.produit}</td><td>${r.description||''}</td><td>${r.compte||'—'}</td><td class="mono" style="color:var(--accent)">${fmt(r.montant)}</td></tr>`).join('');
  document.querySelector('#tblOut tbody').innerHTML = filtered(DB.depenses).filter(d=>((d.description||'')+' '+(d.categorie||'')+' '+(d.projet||'')).toLowerCase().includes(q)).map(d=>`<tr><td>${d.date||'—'}</td><td>${d.projet}</td><td>${d.categorie||''}</td><td>${d.description||''}</td><td>${d.compte||'—'}</td><td class="mono" style="color:var(--danger)">${fmt(d.montant)}</td></tr>`).join('');
}

function renderPrets(){
  const box=document.getElementById('pretsList');
  if(!DB.prets.length){ box.innerHTML=`<p class="muted">Aucun prêt saisi. Ajoute ton prêt bancaire : montant, mensualité, durée → l'appli génère l'échéancier et le reste dû.</p>`; }
  else box.innerHTML=DB.prets.map(p=>{const ech=DB.echeances.filter(e=>e.pret===p.nom); const paye=ech.filter(e=>e.paye).reduce((s,e)=>s+e.montant,0); const tot=ech.reduce((s,e)=>s+e.montant,0); const pct=tot?paye/tot:0;
    return `<div class="pret"><b>${p.nom}</b> — ${p.banque}<br><span class="muted">${fmt(p.montant)} · ${fmt(p.mensualite)}/mois · ${ech.length} mois</span><div class="bar"><i style="width:${pct*100}%"></i></div><span class="mono">Payé ${fmt(paye)} · Reste ${fmt(tot-paye)}</span></div>`}).join('');
  document.querySelector('#tblEch tbody').innerHTML = DB.echeances.map((e,i)=>`<tr><td>${e.pret}</td><td>${e.date}</td><td class="mono">${fmt(e.montant)}</td><td><input type="checkbox" data-i="${i}" ${e.paye?'checked':''} class="paye" aria-label="Échéance ${e.date} payée"> ${e.paye?'Payé':'À payer'}</td></tr>`).join('') || `<tr><td colspan="4" class="muted">—</td></tr>`;
  document.querySelectorAll('.paye').forEach(c=>c.onchange=e=>{DB.echeances[+e.target.dataset.i].paye=e.target.checked; save('echeances',DB.echeances); renderAll();});
  const t=totals();
  document.getElementById('kpiPrets').textContent=fmt(t.restePrets);
  document.getElementById('kpiPretsSub').textContent= DB.prets.length? ` · ${DB.prets.length} prêt(s), ${DB.echeances.filter(e=>!e.paye).length} échéances restantes` : ' — ajoute le 1er prêt';
}
function save(k,v){ localStorage.setItem('fti_'+k, JSON.stringify(v)); }

function buildYears(){
  const ys=[...new Set([...DB.recettes.map(r=>r.annee),...DB.depenses.map(d=>d.annee)])].filter(Boolean).sort();
  const sw=document.getElementById('yearSwitch'); sw.innerHTML='';
  ['toutes',...ys].forEach(y=>{const b=document.createElement('button'); b.textContent=y; if(y===YEAR)b.classList.add('on'); b.onclick=()=>{YEAR=y; buildYears(); renderAll();}; sw.appendChild(b);});
}

/* Navigation sidebar + boutons */
function goto(tab){ document.querySelectorAll('.side-nav button').forEach(b=>{const on=b.dataset.tab===tab; b.classList.toggle('active',on); b.setAttribute('aria-selected',on);}); document.querySelectorAll('main .tab').forEach(s=>s.classList.remove('active')); document.getElementById('tab-'+tab).classList.add('active'); }
document.getElementById('tabs').onclick=e=>{ const btn=e.target.closest('button'); if(btn&&btn.dataset.tab) goto(btn.dataset.tab); };
document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>goto(b.dataset.goto));
document.querySelectorAll('[data-goto-alerts]').forEach(b=>b.onclick=()=>{goto('vue'); setTimeout(()=>document.getElementById('alertsCard').scrollIntoView({behavior:'smooth'}),50);});
document.getElementById('topSearch').oninput=()=>renderTables();

/* Dialogs */
const dlg=document.getElementById('dlg'), fields=document.getElementById('dlgFields'), title=document.getElementById('dlgTitle');
let onOk=null;
function openDlg(t, html, cb){ title.textContent=t; fields.innerHTML=html; onOk=cb; dlg.showModal(); }
document.getElementById('dlgOk').onclick=()=>{ if(onOk) onOk(); };
const inp=(id,label,val='',type='text')=>`<label>${label}<input id="${id}" type="${type}" value="${val}"></label>`;
document.getElementById('btnAddRecette').onclick=()=>openDlg('Nouvelle entrée d’argent', inp('f-date','Date (AAAA-MM-JJ)',new Date().toISOString().slice(0,10))+inp('f-client','Client')+inp('f-projet','Projet (ex: PROJET FORET, LEVE, PROJET ASC — Lot 2)')+inp('f-produit','Produit (ex: LOCATION GPS, LEVE PARCELLE)')+inp('f-desc','Description')+inp('f-montant','Montant FCFA','', 'number'), ()=>{
  const g=id=>document.getElementById(id).value; const r={date:g('f-date'),client:g('f-client'),projet:g('f-projet')||'Sans projet',produit:g('f-produit')||g('f-desc'),description:g('f-desc'),montant:+g('f-montant'),compte:'Espèces (caisse)',annee:yearOf(g('f-date')),categorie:''};
  const arr=JSON.parse(localStorage.getItem('fti_recettes')||'[]'); arr.push(r); save('recettes',arr); location.reload();
});
document.getElementById('btnAddDepense').onclick=()=>openDlg('Nouvelle dépense', inp('f-date','Date',new Date().toISOString().slice(0,10))+inp('f-projet','Projet (ou COUR / SIEGE pour la cour)')+inp('f-cat','Catégorie (personnel, carburant, location, hébergement, restauration, matériel, cour…)')+inp('f-desc','Description')+inp('f-montant','Montant FCFA','', 'number'), ()=>{
  const g=id=>document.getElementById(id).value; const d={date:g('f-date'),projet:g('f-projet')||'COUR / SIEGE',categorie:g('f-cat'),description:g('f-desc'),montant:+g('f-montant'),compte:'Espèces (caisse)',annee:yearOf(g('f-date'))};
  const arr=JSON.parse(localStorage.getItem('fti_depenses')||'[]'); arr.push(d); save('depenses',arr); location.reload();
});
document.getElementById('btnAddProjet').onclick=()=>openDlg('Nouveau projet', inp('f-nom','Nom projet')+inp('f-client','Client')+inp('f-contrat','Montant contrat FCFA','', 'number'), ()=>{
  const g=id=>document.getElementById(id).value; const arr=JSON.parse(localStorage.getItem('fti_projets')||'[]'); arr.push({nom:g('f-nom'),client:g('f-client'),contrat:+g('f-contrat')||null,budget:null,statut:'Nouveau'}); save('projets',arr); location.reload();
});
document.getElementById('btnAddPret').onclick=()=>openDlg('Nouveau prêt bancaire', inp('f-nom','Nom (ex: Prêt BOA pick-up)')+inp('f-banque','Banque')+inp('f-montant','Montant total à rembourser','', 'number')+inp('f-mens','Mensualité','', 'number')+inp('f-nb','Nb mois','12', 'number')+inp('f-date','1ère échéance (AAAA-MM-JJ)',new Date().toISOString().slice(0,10)), ()=>{
  const g=id=>document.getElementById(id).value; const pa=JSON.parse(localStorage.getItem('fti_prets')||'[]'); const ea=JSON.parse(localStorage.getItem('fti_echeances')||'[]');
  pa.push({nom:g('f-nom'),banque:g('f-banque'),montant:+g('f-montant'),mensualite:+g('f-mens')});
  let d=new Date(g('f-date')); for(let i=0;i<(+g('f-nb'));i++){ ea.push({pret:g('f-nom'),date:d.toISOString().slice(0,10),montant:+g('f-mens'),paye:false}); d.setMonth(d.getMonth()+1); }
  save('prets',pa); save('echeances',ea); location.reload();
});

load();
if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches){document.body.classList.add('anim');}
