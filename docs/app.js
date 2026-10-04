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
  buildYears(); renderAll();
}
function yearOf(d){ if(!d) return 'Sans date'; const m=/^(\d{4})/.exec(d); return m?m[1]:'Sans date'; }
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

function bullet(pct){
  const p=Math.max(0,Math.min(1,pct));
  return `<span class="q1"></span><span class="q2"></span><span class="q3"></span><span class="perf" style="width:calc(${(p*100).toFixed(1)}% - 2px)"></span><span class="target" style="left:100%"></span>`;
}
function ringSVG(pct,color,label,val,sub){
  const c=2*Math.PI*44, off=c*(1-Math.min(1,pct));
  return `<div class="ring"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="44" fill="none" stroke="#14201A18" stroke-width="12"/><circle cx="50" cy="50" r="44" fill="none" stroke="${color}" stroke-width="12" stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 50 50)"/><text x="50" y="56" text-anchor="middle" font-size="16" font-weight="800" fill="#14201A">${Math.round(pct*100)}%</text></svg><b>${label}</b><span>${val}</span><br><span>${sub}</span></div>`;
}

let charts={};
function renderAll(){
  const t=totals();
  document.getElementById('kpiTréso').textContent=fmt(t.trezo);
  document.getElementById('kpiTrésoSub').textContent=`${t.rec.length} entrées · ${t.dep.length} dépenses (${YEAR})`;
  document.getElementById('kpiIn').textContent=fmt(t.tin);
  document.getElementById('kpiInSub').textContent=`dont FORET ${fmt(t.rec.filter(r=>r.projet==='PROJET FORET').reduce((s,x)=>s+x.montant,0))}`;
  document.getElementById('kpiOut').textContent=fmt(t.tou);
  document.getElementById('kpiOutSub').textContent=`dont ASC ${fmt(t.dep.filter(d=>d.projet.includes('ASC')).reduce((s,x)=>s+x.montant,0))}`;
  const depAsc = DB.depenses.filter(d=>d.projet.includes('ASC')).reduce((s,x)=>s+x.montant,0);
  const budget = 13104401.625;
  document.getElementById('kpiAscReste').textContent=fmt(budget-depAsc);
  document.getElementById('kpiPrets').textContent=fmt(t.restePrets);
  document.getElementById('kpiPretsSub').textContent= DB.prets.length? `${DB.prets.length} prêt(s) · ${DB.echeances.filter(e=>!e.paye).length} échéances restantes` : 'Aucun prêt saisi — ajoute le 1er';

  document.getElementById('rings').innerHTML =
    ringSVG(depAsc/budget,'#DC2626','Budget ASC consommé',fmt(depAsc),`reste ${fmt(budget-depAsc)}`) +
    ringSVG(t.tou/Math.max(1,t.tin),'#059669','Dépenses / Entrées',fmt(t.tou),`${fmt(t.tin)} encaissés`) +
    ringSVG(t.rec.filter(r=>r.projet==='PROJET FORET').reduce((s,x)=>s+x.montant,0)/Math.max(1,t.tin),'#3B82F6','Part FORET',fmt(t.rec.filter(r=>r.projet==='PROJET FORET').reduce((s,x)=>s+x.montant,0)),'sur total entrées') +
    ringSVG(DB.prets.length? (DB.echeances.filter(e=>e.paye).reduce((s,e)=>s+e.montant,0)/Math.max(1,DB.echeances.reduce((s,e)=>s+e.montant,0))):0,'#1E40AF','Prêts remboursés',fmt(DB.echeances.filter(e=>e.paye).reduce((s,e)=>s+e.montant,0)), DB.prets.length?'sur total dû':'aucun prêt');
  const totEch=DB.echeances.reduce((s,e)=>s+e.montant,0), payeEch=DB.echeances.filter(e=>e.paye).reduce((s,e)=>s+e.montant,0);
  document.getElementById('bulTrezo').innerHTML=bullet(t.tou/Math.max(1,t.tin));
  document.getElementById('bulDep').innerHTML=bullet(t.tou/Math.max(1,t.tin));
  document.getElementById('bulAsc').innerHTML=bullet(depAsc/budget);
  document.getElementById('bulPret').innerHTML=bullet(totEch?payeEch/totEch:0);

  document.getElementById('alerts').innerHTML = [
    `<li><b>Devise CHF dans l'Excel</b> → appli forcée en FCFA. TVA à 0, à paramétrer au Bénin.</li>`,
    `<li><b>Location pick-up 35 000 FCFA/j</b> provisoire (3 080 000 au budget) — à confirmer par devis, c'est ton plus gros risque.</li>`,
    `<li><b>KMZ 276,6 km / 347,5 km</b> — 70,9 km manquants, mobilité = enveloppe, pas relevé GPS définitif.</li>`,
    `<li><b>Contrat ASC 37M non encaissé</b> dans la compta — seuls 270 000 FCFA de dépenses ASC saisies (2% du budget).</li>`,
    `<li><b>Comptes non renseignés</b> — tout passe en Espèces (caisse). Renseigne banque / Mobile Money pour la tréso réelle.</li>`
  ].join('');

  renderTables(); renderCharts(); renderPrets();
}

function groupBy(list,key){ const m={}; list.forEach(x=>{const k=x[key]||'—'; m[k]=(m[k]||0)+x.montant;}); return m; }

function renderCharts(){
  Object.values(charts).forEach(c=>c&&c.destroy()); charts={};
  if(typeof Chart==='undefined') return;
  const projs=[...new Set([...DB.recettes.map(r=>r.projet),...DB.depenses.map(d=>d.projet)])];
  const rin=projs.map(p=>filtered(DB.recettes).filter(r=>r.projet===p).reduce((s,x)=>s+x.montant,0));
  const rou=projs.map(p=>filtered(DB.depenses).filter(d=>d.projet===p).reduce((s,x)=>s+x.montant,0));
  charts.p= new Chart(document.getElementById('chProjets'),{type:'bar',data:{labels:projs,datasets:[{label:'Entrées',data:rin,backgroundColor:'#059669'},{label:'Dépenses',data:rou,backgroundColor:'#DC2626'}]},options:{plugins:{legend:{position:'bottom'}},scales:{y:{ticks:{callback:v=>fmtN(v)}}}}});
  document.getElementById('projLegend').textContent = projs.map((p,i)=>`${p}: +${fmtN(rin[i])} / -${fmtN(rou[i])}`).join(' · ');
  const years=[...new Set([...DB.recettes.map(r=>r.annee),...DB.depenses.map(d=>d.annee)])].sort();
  charts.a=new Chart(document.getElementById('chAnnees'),{type:'bar',data:{labels:years,datasets:[{label:'Entrées',data:years.map(y=>DB.recettes.filter(r=>String(r.annee)===String(y)).reduce((s,x)=>s+x.montant,0)),backgroundColor:'#3B82F6'},{label:'Dépenses',data:years.map(y=>DB.depenses.filter(r=>String(r.annee)===String(y)).reduce((s,x)=>s+x.montant,0)),backgroundColor:'#1E40AF'}]},options:{plugins:{legend:{position:'bottom'}}}});
  const g=groupBy(filtered(DB.recettes),'produit'); 
  charts.pr=new Chart(document.getElementById('chProduits'),{type:'doughnut',data:{labels:Object.keys(g),datasets:[{data:Object.values(g),backgroundColor:['#059669','#3B82F6','#1E40AF','#DC2626','#7A5CFF','#00B8A9']}]},options:{plugins:{legend:{position:'bottom'}}}});
}

function renderTables(){
  // projets
  const allProjs=[...DB.projetsBase, ...DB.projetsPerso];
  const tb=document.querySelector('#tblProjets tbody'); tb.innerHTML='';
  allProjs.forEach(p=>{
    const ein=DB.recettes.filter(r=>r.projet===p.nom||(p.nom.includes('ASC')&&r.projet.includes('ASC'))).reduce((s,x)=>s+x.montant,0);
    const eout=DB.depenses.filter(d=>d.projet===p.nom||(p.nom.includes('ASC')&&d.projet.includes('ASC'))).reduce((s,x)=>s+x.montant,0);
    // mapping simplifié : FORET/LEVE/LOCATION exacts
    const ein2 = p.nom==='PROJET FORET'? DB.recettes.filter(r=>r.projet==='PROJET FORET').reduce((s,x)=>s+x.montant,0)
      : p.nom==='LEVE'? DB.recettes.filter(r=>r.projet==='LEVE').reduce((s,x)=>s+x.montant,0)
      : p.nom==='LOCATION APPAREILS'? DB.recettes.filter(r=>r.projet==='LOCATION APPAREILS').reduce((s,x)=>s+x.montant,0) : ein;
    const ref = p.contrat ?? ein2;
    const reste = ref - eout;
    const marge = p.contrat? ((p.contrat-(p.budget||eout))/p.contrat*100): null;
    tb.innerHTML+=`<tr><td><b>${p.nom}</b><br><span class="muted">${p.client||''}</span></td><td>${p.client||'—'}</td><td class="mono">${p.contrat?fmt(p.contrat):'—'}</td><td class="mono green">${fmt(ein2||ein)}</td><td class="mono red">${fmt(eout)}</td><td class="mono"><b>${fmt(reste)}</b></td><td>${marge===null?'—':marge.toFixed(1)+'%'}</td><td>${p.statut||''}</td></tr>`;
  });
  document.querySelector('#tblBudget tbody').innerHTML = (DB.detailCouts||[]).map(d=>`<tr><td>${d.poste}</td><td>${d.qte} ${d.unite||''}</td><td>${fmtN(d.pu)}</td><td class="mono">${fmt(d.total)}</td><td>${d.statut||''}</td></tr>`).join('');
  const gp=groupBy(filtered(DB.recettes),'produit');
  document.querySelector('#tblProduits tbody').innerHTML = Object.entries(gp).sort((a,b)=>b[1]-a[1]).map(([k,v])=>{const n=filtered(DB.recettes).filter(r=>r.produit===k).length;return `<tr><td>${k}</td><td>Topographie</td><td>${n}</td><td class="mono green">${fmt(v)}</td><td>${(v/Math.max(1,totals().tin)*100).toFixed(1)}%</td></tr>`}).join('');
  const q=(document.getElementById('searchIn').value||'').toLowerCase();
  document.querySelector('#tblIn tbody').innerHTML = filtered(DB.recettes).filter(r=>(r.client+' '+r.description+' '+r.produit+' '+r.projet).toLowerCase().includes(q)).map(r=>`<tr><td>${r.date||'—'}</td><td>${r.client||'—'}</td><td>${r.projet}</td><td>${r.produit}</td><td>${r.description||''}</td><td>${r.compte||'—'}</td><td class="mono green">${fmt(r.montant)}</td></tr>`).join('');
  const q2=(document.getElementById('searchOut').value||'').toLowerCase();
  document.querySelector('#tblOut tbody').innerHTML = filtered(DB.depenses).filter(d=>((d.description||'')+' '+(d.categorie||'')+' '+(d.projet||'')).toLowerCase().includes(q2)).map(d=>`<tr><td>${d.date||'—'}</td><td>${d.projet}</td><td>${d.categorie||''}</td><td>${d.description||''}</td><td>${d.compte||'—'}</td><td class="mono red">${fmt(d.montant)}</td></tr>`).join('');
}

function renderPrets(){
  const box=document.getElementById('pretsList');
  if(!DB.prets.length){ box.innerHTML=`<p class="muted">Aucun prêt saisi. Ajoute ton prêt bancaire : montant, mensualité, durée → l'appli génère l'échéancier et le reste dû.</p>`; }
  else box.innerHTML=DB.prets.map(p=>{const ech=DB.echeances.filter(e=>e.pret===p.nom); const paye=ech.filter(e=>e.paye).reduce((s,e)=>s+e.montant,0); const tot=ech.reduce((s,e)=>s+e.montant,0); const pct=tot?paye/tot:0;
    return `<div class="pret"><b>${p.nom}</b> — ${p.banque}<br><span class="muted">${fmt(p.montant)} · ${fmt(p.mensualite)}/mois · ${ech.length} mois</span><div class="bar"><i style="width:${pct*100}%"></i></div><span class="mono">Payé ${fmt(paye)} · Reste ${fmt(tot-paye)}</span></div>`}).join('');
  document.querySelector('#tblEch tbody').innerHTML = DB.echeances.map((e,i)=>`<tr><td>${e.pret}</td><td>${e.date}</td><td class="mono">${fmt(e.montant)}</td><td><input type="checkbox" data-i="${i}" ${e.paye?'checked':''} class="paye"> ${e.paye?'Payé':'À payer'}</td></tr>`).join('') || `<tr><td colspan="4" class="muted">—</td></tr>`;
  document.querySelectorAll('.paye').forEach(c=>c.onchange=e=>{DB.echeances[+e.target.dataset.i].paye=e.target.checked; save('echeances',DB.echeances); renderAll();});
}
function save(k,v){ localStorage.setItem('fti_'+k, JSON.stringify(v)); }

function buildYears(){
  const ys=[...new Set([...DB.recettes.map(r=>r.annee),...DB.depenses.map(d=>d.annee)])].filter(Boolean).sort();
  const sw=document.getElementById('yearSwitch'); sw.innerHTML='';
  ['toutes',...ys].forEach(y=>{const b=document.createElement('button'); b.textContent=y; if(y===YEAR)b.classList.add('on'); b.onclick=()=>{YEAR=y; buildYears(); renderAll();}; sw.appendChild(b);});
}

// tabs
document.getElementById('tabs').onclick=e=>{ const btn=e.target.closest('button'); if(btn&&btn.dataset.tab){ document.querySelectorAll('.tabs button').forEach(b=>{b.classList.remove('active');b.setAttribute('aria-selected','false');}); btn.classList.add('active'); btn.setAttribute('aria-selected','true'); document.querySelectorAll('main .tab').forEach(s=>s.classList.remove('active')); document.getElementById('tab-'+btn.dataset.tab).classList.add('active'); }};
document.getElementById('searchIn').oninput=renderTables; document.getElementById('searchOut').oninput=renderTables;

// dialogs génériques
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
