'use strict';

const STORAGE_PREFIX = 'ribera_supabase_content_hub';
const RIBERA_EMAIL = 'ribera.audiovisuales@gmail.com';
const RIBERA_COMPANY_NAME = 'Ribera Audiovisual';
const DEFAULT_COLORS = ['#1a6ff4', '#f28c28', '#2f7d5a', '#7c3aed', '#dc2626', '#0891b2', '#d97706', '#db2777'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const STATUS = [
  {key:'idea', label:'Idea', pill:'amber'},
  {key:'produccion', label:'Producción', pill:'blue'},
  {key:'edicion', label:'Edición', pill:'violet'},
  {key:'revision', label:'Revisión', pill:'violet'},
  {key:'publicado', label:'Publicado', pill:'green'}
];
const IDEA_STAGES = [
  {key:'cruda', label:'Crudas'},
  {key:'validada', label:'Validadas'},
  {key:'futura', label:'Futuras'},
  {key:'descartada', label:'Descartadas'}
];
const ASSET_TYPES = ['Logo','Manual de marca','Foto','Video','Carpeta Drive','Referencia','Copy / texto','Plantilla','Otro'];
const CHANNELS = ['Instagram','TikTok','Reels','YouTube','Facebook','LinkedIn','WhatsApp','Web','Otro'];
const CONTENT_TYPES = ['Foto','Historia','Carrusel','Reel','Video','Comercial','Tutorial','Meme','Encuesta','Live','Post','Newsletter'];
const PROSPECT_STATUSES = ['Prospecto','Contactado','Reunión agendada','Propuesta enviada','Ganado','Perdido'];
const PROSPECT_INTERESTS = ['Contenido mensual','Producción audiovisual','Redes sociales','Campaña puntual','Branding / identidad','Cobertura evento','Otro'];

let sb = null;
let session = null;
let currentView = 'inicio';
let currentCompanyId = localStorage.getItem(`${STORAGE_PREFIX}_company`) || '';
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let state = { companies: [], items: [], assets: [], prospects: [], month_notes: [], responsibles: [] };
let isBusy = false;

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (v='') => String(v ?? '').replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
const escAttr = esc;
const todayISO = () => new Date().toISOString().slice(0,10);
const toISODate = d => d ? new Date(d).toISOString().slice(0,10) : '';
const parseTags = v => (v || '').split(',').map(x=>x.trim()).filter(Boolean).join(', ');
const normalize = v => String(v||'').trim().toLowerCase();
const isRiberaUser = () => normalize(session?.user?.email) === normalize(RIBERA_EMAIL);
const isRiberaCompany = (company) => normalize(company?.name) === normalize(RIBERA_COMPANY_NAME);
function visibleCompanies(){ return state.companies.filter(c => isRiberaUser() || !isRiberaCompany(c)); }
function riberaCompany(){ return state.companies.find(isRiberaCompany) || null; }
function canViewClients(){ return isRiberaUser() && isRiberaCompany(companyById()); }
function updateAccessUI(){
  const nav = $('#nav-clientes');
  if(nav) nav.classList.toggle('hidden', !canViewClients());
}

function show(el){ el?.classList.remove('hidden'); }
function hide(el){ el?.classList.add('hidden'); }
function toast(msg, type='ok'){
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast ${type}`;
  show(el);
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(()=>hide(el), 2800);
}
function setBusy(v){ isBusy = !!v; }
function initials(name=''){
  const parts = String(name||'').trim().split(/\s+/).filter(Boolean);
  if(!parts.length) return 'CI';
  return parts.slice(0,2).map(p=>p[0]).join('').toUpperCase();
}
function colorForName(name=''){
  let hash = 0;
  for(const ch of String(name)) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return DEFAULT_COLORS[hash % DEFAULT_COLORS.length];
}
function softColor(hex){
  return `${hex}18`;
}
function companyById(id=currentCompanyId){
  return state.companies.find(c=>c.id===id) || state.companies[0] || null;
}
function companyMeta(company){
  const c = company || companyById();
  const color = c?.color || colorForName(c?.name || 'Clean It');
  return { color, dark: color, soft: softColor(color), logo: c?.logo_url || '', initials: initials(c?.name || 'Clean It') };
}
function logoHTML(company, cls=''){
  const meta = companyMeta(company);
  if(meta.logo) return `<img src="${escAttr(meta.logo)}" alt="${escAttr(company?.name || 'Empresa')}" />`;
  return `<span>${esc(meta.initials)}</span>`;
}
function applyCompanyTheme(){
  const company = companyById();
  const meta = companyMeta(company);
  document.documentElement.style.setProperty('--company', meta.color);
  document.documentElement.style.setProperty('--company-dark', meta.dark);
  document.documentElement.style.setProperty('--company-soft', meta.soft);
  $('#sidebar-company-logo').innerHTML = logoHTML(company);
  $('#topbar-company-logo').innerHTML = logoHTML(company);
  $('#sidebar-company-name').textContent = company?.name || 'Content Hub';
  $('#active-company-label').textContent = company?.name || 'Elegir empresa';
  $('#page-title').textContent = `${viewTitle(currentView)}${company ? ' · ' + company.name : ''}`;
  updateAccessUI();
}
function viewTitle(v){
  return ({inicio:'Inicio',calendario:'Calendario',kanban:'Kanban',ideas:'Ideas',biblioteca:'Biblioteca',clientes:'Posibles clientes',metricas:'Métricas',config:'Configuración'})[v] || 'Content Hub';
}
function filteredItems(){
  return currentCompanyId ? state.items.filter(i => i.company_id === currentCompanyId) : state.items;
}
function filteredAssets(){
  return currentCompanyId ? state.assets.filter(a => a.company_id === currentCompanyId) : state.assets;
}
function statusLabel(key){ return STATUS.find(s=>s.key===key)?.label || key; }
function statusPill(key){ return STATUS.find(s=>s.key===key)?.pill || 'blue'; }
function fmtDate(v){
  if(!v) return 'Sin fecha';
  const [y,m,d] = String(v).split('-');
  if(!y||!m||!d) return v;
  return `${d}/${m}/${y}`;
}
function isOverdue(item){
  if(!item.internal_deadline || item.status === 'publicado') return false;
  return item.internal_deadline < todayISO();
}
function isDueToday(item){ return item.internal_deadline === todayISO() && item.status !== 'publicado'; }
function addDays(date, days){ const d = new Date(date); d.setDate(d.getDate()+days); return d; }
function startOfWeek(date=new Date()){
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0,0,0,0);
  return d;
}
function weekRange(){
  const start = startOfWeek();
  const end = addDays(start, 6);
  return { start: toISODate(start), end: toISODate(end), startDate:start, endDate:end };
}
function inRange(date, start, end){ return date && date >= start && date <= end; }

function monthKey(){ return `${currentYear}-${String(currentMonth+1).padStart(2,'0')}`; }
function parseJSONList(v){
  if(Array.isArray(v)) return v.filter(Boolean);
  if(!v) return [];
  try { const parsed = JSON.parse(v); return Array.isArray(parsed) ? parsed.filter(Boolean) : []; } catch { return []; }
}
function uniqSortedDates(list){
  return [...new Set((list||[]).filter(Boolean).map(String))].sort();
}
function parseDateInputList(raw){
  return uniqSortedDates(String(raw||'').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean));
}
function datesToInput(list){ return uniqSortedDates(parseJSONList(list)).join(', '); }
function daysBetween(a,b){
  const da = new Date(a+'T00:00:00');
  const db = new Date(b+'T00:00:00');
  return Math.round((db-da)/86400000);
}
function shiftISODate(iso, days){ return toISODate(addDays(new Date(iso+'T00:00:00'), days)); }
function phaseDates(item, phase){
  if(!item) return [];
  if(phase==='idea') return item.idea_date ? [item.idea_date] : [];
  if(phase==='produccion') return uniqSortedDates(parseJSONList(item.production_dates));
  if(phase==='edicion') return uniqSortedDates(parseJSONList(item.editing_dates));
  if(phase==='revision') return uniqSortedDates(parseJSONList(item.review_dates));
  if(phase==='publicacion') return item.publish_date ? [item.publish_date] : [];
  return [];
}
function setPhasePayload(phase, dates){
  const list = uniqSortedDates(dates);
  if(phase==='idea') return { idea_date: list[0] || null };
  if(phase==='produccion') return { production_dates: list };
  if(phase==='edicion') return { editing_dates: list };
  if(phase==='revision') return { review_dates: list };
  if(phase==='publicacion') return { publish_date: list[0] || null };
  return {};
}
const PHASE_META = {
  idea:{icon:'💡', label:'Idea', cls:'phase-idea'},
  produccion:{icon:'🎬', label:'Producción', cls:'phase-produccion'},
  edicion:{icon:'✂️', label:'Edición', cls:'phase-edicion'},
  revision:{icon:'👁️', label:'Revisión', cls:'phase-revision'},
  publicacion:{icon:'📣', label:'Publicación estimada', cls:'phase-publicacion'},
  publicado:{icon:'✅', label:'Publicado', cls:'phase-publicado'},
  nota:{icon:'📝', label:'Nota', cls:'phase-nota'}
};
function eventSegments(dates, date){
  const set = new Set(dates);
  const prev = shiftISODate(date,-1), next = shiftISODate(date,1);
  const hasPrev = set.has(prev), hasNext = set.has(next);
  if(hasPrev && hasNext) return 'seg-mid';
  if(hasNext) return 'seg-start';
  if(hasPrev) return 'seg-end';
  return 'seg-single';
}
function calendarEventsForItem(item){
  const events=[];
  const activePhase = item.status === 'publicado' ? null : item.status;
  ['idea','produccion','edicion','revision'].forEach(phase=>{
    if(phase !== activePhase) return;
    const dates = phaseDates(item, phase);
    dates.forEach(date=>events.push({kind:'content', item, phase, date, dates, meta:PHASE_META[phase]}));
  });
  if(item.publish_date){
    const phase = item.status === 'publicado' ? 'publicado' : 'publicacion';
    const dates = [item.publish_date];
    events.push({kind:'content', item, phase:'publicacion', date:item.publish_date, dates, meta:PHASE_META[phase], published:item.status==='publicado'});
  }
  return events;
}
function principalCalendarDate(i){
  return i.publish_date || phaseDates(i,'produccion')[0] || phaseDates(i,'edicion')[0] || phaseDates(i,'revision')[0] || i.idea_date || i.internal_deadline || '';
}
function ownerOptions(selected=''){
  const list = state.responsibles.length ? state.responsibles.map(r=>r.name) : ['Nacho','Lilu'];
  const merged = [...new Set(['', ...list, 'Compartido'])];
  return merged.map(name=>`<option value="${escAttr(name)}" ${name===selected?'selected':''}>${esc(name || 'Sin responsable')}</option>`).join('');
}
async function ensureDefaultResponsibles(){
  const company = companyById();
  if(!company || state.responsibles.some(r=>r.company_id===company.id)) return;
  const rows = ['Nacho','Lilu'].map(name=>({company_id:company.id,name}));
  const { error } = await sb.from('responsibles').upsert(rows, { onConflict:'company_id,name' });
  if(!error) await loadAll();
}
function monthNotes(){ return state.month_notes.filter(n=>n.company_id===currentCompanyId && n.month_key===monthKey()); }


async function init(){
  if(!window.SUPABASE_CONFIG || !window.SUPABASE_CONFIG.url || !window.SUPABASE_CONFIG.anonKey){
    hide($('#auth-screen')); hide($('#company-gate')); hide($('#app')); show($('#setup-screen'));
    return;
  }
  try{
    sb = window.supabase.createClient(window.SUPABASE_CONFIG.url, window.SUPABASE_CONFIG.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }catch(err){
    showSetupError(err.message);
    return;
  }

  bindStaticEvents();
  const { data } = await sb.auth.getSession();
  session = data.session;
  sb.auth.onAuthStateChange((event, newSession)=>{
    const hadSession = !!session;
    session = newSession;
    if(!session){ showAuth(); return; }
    if(hadSession && !$('#app').classList.contains('hidden')){
      $('#user-email').textContent = session?.user?.email || 'usuario';
      $('#user-avatar').textContent = initials(session?.user?.email || 'U').slice(0,1);
      return;
    }
    bootApp();
  });
  if(session) bootApp(); else showAuth();
}
function showSetupError(msg){
  show($('#setup-screen'));
  $('.setup-card p').innerHTML = `No se pudo inicializar Supabase: <strong>${esc(msg)}</strong>`;
}
function bindStaticEvents(){
  $('#auth-form').addEventListener('submit', async e=>{
    e.preventDefault();
    await signIn();
  });
  $('#signup-btn').addEventListener('click', signUp);
  $('#logout-btn').addEventListener('click', async()=>{ await sb.auth.signOut(); });
  $('#change-company-btn').addEventListener('click', renderCompanyGate);
  $('#reload-btn').addEventListener('click', async()=>{ await loadAll(); render(); toast('Datos actualizados'); });
  $('#new-content-btn').addEventListener('click', ()=>openContentModal());
  $$('.nav-item').forEach(btn=>btn.addEventListener('click', ()=>switchView(btn.dataset.view)));
  updateAccessUI();
}
async function signIn(){
  const email = $('#auth-email').value.trim();
  const password = $('#auth-password').value;
  const errBox = $('#auth-error'); hide(errBox);
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if(error){ errBox.textContent = error.message; show(errBox); }
}
async function signUp(){
  const email = $('#auth-email').value.trim();
  const password = $('#auth-password').value;
  const errBox = $('#auth-error'); hide(errBox);
  if(!email || !password){ errBox.textContent = 'Completá email y contraseña.'; show(errBox); return; }
  const { error } = await sb.auth.signUp({ email, password });
  if(error){ errBox.textContent = error.message; show(errBox); return; }
  toast('Cuenta creada. Si Supabase pide confirmación por email, revisá el correo antes de ingresar.');
}
function showAuth(){
  hide($('#setup-screen')); hide($('#company-gate')); hide($('#app')); show($('#auth-screen'));
}
async function bootApp(){
  hide($('#setup-screen')); hide($('#auth-screen'));
  $('#user-email').textContent = session?.user?.email || 'usuario';
  $('#user-avatar').textContent = initials(session?.user?.email || 'U').slice(0,1);
  await loadAll();
  if(!state.companies.length) await ensureDefaultCompanies();
  const availableCompanies = visibleCompanies();
  if(!currentCompanyId || !availableCompanies.some(c=>c.id===currentCompanyId)) currentCompanyId = availableCompanies[0]?.id || '';
  if(isRiberaUser() && !riberaCompany()) await ensureRiberaCompany();
  await ensureDefaultResponsibles();
  localStorage.setItem(`${STORAGE_PREFIX}_company`, currentCompanyId);
  renderCompanyGate();
  subscribeChanges();
}
async function ensureDefaultCompanies(){
  const defaults = [
    { name:'Clean It', color:'#1a6ff4' },
    { name:'Mundo Chipa', color:'#f28c28' },
    { name:'La Clasica', color:'#2f7d5a' },
    ...(isRiberaUser() ? [{ name:RIBERA_COMPANY_NAME, color:'#101828' }] : [])
  ];
  const { error } = await sb.from('companies').upsert(defaults, { onConflict:'name' });
  if(error) throwError(error);
  await loadAll();
}
async function ensureRiberaCompany(){
  if(!isRiberaUser()) return;
  const { error } = await sb.from('companies').upsert([{ name:RIBERA_COMPANY_NAME, color:'#101828' }], { onConflict:'name' });
  if(error) throwError(error);
  await loadAll();
}
let channel = null;
function subscribeChanges(){
  if(channel) return;
  channel = sb.channel('content-hub-db')
    .on('postgres_changes', {event:'*', schema:'public', table:'companies'}, debounceReload)
    .on('postgres_changes', {event:'*', schema:'public', table:'content_items'}, debounceReload)
    .on('postgres_changes', {event:'*', schema:'public', table:'assets'}, debounceReload)
    .on('postgres_changes', {event:'*', schema:'public', table:'prospects'}, debounceReload)
    .on('postgres_changes', {event:'*', schema:'public', table:'month_notes'}, debounceReload)
    .on('postgres_changes', {event:'*', schema:'public', table:'responsibles'}, debounceReload)
    .subscribe();
}
let reloadTimer = null;
function debounceReload(){
  clearTimeout(reloadTimer);
  reloadTimer = setTimeout(async()=>{ await loadAll(); render(); }, 700);
}
async function loadAll(){
  setBusy(true);
  const promises = [
    sb.from('companies').select('*').order('name'),
    sb.from('content_items').select('*').order('created_at', {ascending:false}),
    sb.from('assets').select('*').order('created_at', {ascending:false}),
    sb.from('month_notes').select('*').order('sort_order', {ascending:true}).order('created_at', {ascending:true}),
    sb.from('responsibles').select('*').order('name')
  ];
  if(isRiberaUser()) promises.push(sb.from('prospects').select('*').order('updated_at', {ascending:false}));
  const [companies, items, assets, monthNotes, responsibles, prospects] = await Promise.all(promises);
  if(companies.error) throwError(companies.error);
  if(items.error) throwError(items.error);
  if(assets.error) throwError(assets.error);
  if(monthNotes.error) throwError(monthNotes.error);
  if(responsibles.error) throwError(responsibles.error);
  if(prospects?.error) throwError(prospects.error);
  state.companies = companies.data || [];
  state.items = items.data || [];
  state.assets = assets.data || [];
  state.month_notes = monthNotes.data || [];
  state.responsibles = responsibles.data || [];
  state.prospects = prospects?.data || [];
  setBusy(false);
}
function throwError(error){
  console.error(error);
  toast(error.message || 'Error en Supabase', 'error');
  throw error;
}

function renderCompanyGate(){
  hide($('#setup-screen')); hide($('#auth-screen')); hide($('#app')); show($('#company-gate'));
  $('#company-gate').innerHTML = `<div class="company-entry">
    <div class="company-entry-card">
      <div class="company-entry-head">
        <div>
          <div class="brand-row"><div class="brand-mark">R</div><div><div class="brand-title">Ribera Content Hub</div><div class="brand-subtitle">Supabase operativo</div></div></div>
          <h1>Elegí la empresa antes de trabajar</h1>
          <p>Los contenidos, ideas y assets se cargan en una base compartida. Ribera Audiovisual solo aparece para el usuario autorizado.</p>
        </div>
        <button class="btn ghost sm" onclick="window.__signOut()"><i class="fa-solid fa-arrow-right-from-bracket"></i> Salir</button>
      </div>
      <div class="company-grid">
        ${visibleCompanies().map(c=>renderCompanyCard(c)).join('')}
      </div>
      ${!visibleCompanies().length ? '<div class="empty">No hay empresas visibles para este usuario.</div>' : ''}
    </div>
  </div>`;
}
window.__signOut = async()=>{ await sb.auth.signOut(); };
function renderCompanyCard(c){
  const meta = companyMeta(c);
  const count = state.items.filter(i=>i.company_id===c.id).length;
  return `<button class="company-card ${currentCompanyId===c.id?'active':''}" style="--company:${meta.color};--company-dark:${meta.dark};--company-soft:${meta.soft}" onclick="window.__enterCompany('${c.id}')">
    <div>
      <div class="company-card-top"><div class="company-logo">${logoHTML(c)}</div>${currentCompanyId===c.id?'<span class="current-pill">Actual</span>':''}</div>
      <div class="company-card-name">${esc(c.name)}</div>
      <div class="company-card-count">${count} contenido${count===1?'':'s'} · ${state.assets.filter(a=>a.company_id===c.id).length} asset${state.assets.filter(a=>a.company_id===c.id).length===1?'':'s'}</div>
    </div>
  </button>`;
}
window.__enterCompany = (id)=>{
  const target = visibleCompanies().find(c=>c.id===id);
  if(!target){ toast('No tenés acceso a esa empresa.', 'error'); return; }
  currentCompanyId = id;
  localStorage.setItem(`${STORAGE_PREFIX}_company`, id);
  hide($('#company-gate')); show($('#app'));
  applyCompanyTheme();
  render();
};
function switchView(v){
  if(v==='clientes' && !canViewClients()){ toast('La pestaña de posibles clientes es exclusiva de Ribera Audiovisual.', 'error'); return; }
  currentView = v;
  $$('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.view===v));
  applyCompanyTheme();
  render();
}
function render(){
  applyCompanyTheme();
  const content = $('#content');
  if(currentView==='clientes' && !canViewClients()) currentView='inicio';
  $$('.nav-item').forEach(b=>b.classList.toggle('active', b.dataset.view===currentView));
  const views = { inicio: renderInicio, calendario: renderCalendario, kanban: renderKanban, ideas: renderIdeas, biblioteca: renderBiblioteca, clientes: renderClientes, metricas: renderMetricas, config: renderConfig };
  content.innerHTML = `<div class="loading">Cargando...</div>`;
  content.innerHTML = (views[currentView] || renderInicio)();
}

function calcMetrics(items=filteredItems()){
  const now = todayISO();
  const week = weekRange();
  return {
    total: items.length,
    published: items.filter(i=>i.status==='publicado').length,
    inProcess: items.filter(i=>['produccion','edicion','revision'].includes(i.status)).length,
    ideas: items.filter(i=>i.status==='idea').length,
    overdue: items.filter(isOverdue).length,
    dueToday: items.filter(isDueToday).length,
    dueWeek: items.filter(i=>i.status!=='publicado' && inRange(i.internal_deadline, week.start, week.end)).length,
    noDeadline: items.filter(i=>i.status!=='publicado' && !i.internal_deadline).length,
    validatedIdeas: items.filter(i=>i.status==='idea' && i.idea_stage==='validada').length,
    publishedThisMonth: items.filter(i=>i.status==='publicado' && (i.publish_date||'').startsWith(`${currentYear}-${String(currentMonth+1).padStart(2,'0')}`)).length
  };
}
function renderStats(m=calcMetrics()){
  return `<div class="stats-grid">
    ${stat('Atrasados', m.overdue, 'fa-triangle-exclamation', 'bg-red', 'deadline interno vencido')}
    ${stat('Vencen hoy', m.dueToday, 'fa-clock', 'bg-amber', 'requieren acción')}
    ${stat('En proceso', m.inProcess, 'fa-gears', 'bg-blue', 'producción + edición + revisión')}
    ${stat('Ideas validadas', m.validatedIdeas, 'fa-lightbulb', 'bg-green', 'listas para producir')}
  </div>`;
}
function stat(label, value, icon, bg, sub){
  return `<div class="stat-card"><div class="stat-icon ${bg}"><i class="fa-solid ${icon}"></i></div><div class="stat-value">${value}</div><div class="stat-label">${label}</div><div class="stat-sub">${sub}</div></div>`;
}
function renderInicio(){
  const items = filteredItems();
  const todayTasks = items.filter(i=>i.status!=='publicado' && (isDueToday(i) || isOverdue(i))).sort(sortByDeadline);
  const week = weekRange();
  const weekTasks = items.filter(i=>i.status!=='publicado' && inRange(i.internal_deadline, week.start, week.end)).sort(sortByDeadline);
  const recent = [...items].sort((a,b)=>String(b.updated_at||b.created_at).localeCompare(String(a.updated_at||a.created_at))).slice(0,6);
  return `${renderStats()}
    <div class="section-grid">
      <div>
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Modo Hoy</div><button class="btn primary sm" onclick="openContentModal()"><i class="fa-solid fa-plus"></i> Nueva pieza</button></div>
          ${todayTasks.length ? `<div class="list">${todayTasks.map(renderItem).join('')}</div>` : `<div class="empty">Sin atrasos ni deadlines para hoy. Eso es margen operativo, no vacaciones.</div>`}
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Vista semanal simple</div><button class="btn ghost sm" onclick="switchView('calendario')">Ver calendario</button></div>
          ${renderWeekBoard(weekTasks)}
        </div>
      </div>
      <div>
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Recientes</div><button class="btn ghost sm" onclick="switchView('kanban')">Ver kanban</button></div>
          ${recent.length ? `<div class="list">${recent.map(renderItemCompact).join('')}</div>` : `<div class="empty">Todavía no hay contenidos cargados.</div>`}
        </div>
        <div class="panel">
          <div class="panel-head"><div class="panel-title">Biblioteca</div><button class="btn ghost sm" onclick="switchView('biblioteca')">Ver assets</button></div>
          ${renderAssetSummary()}
        </div>
      </div>
    </div>`;
}
function sortByDeadline(a,b){ return String(a.internal_deadline || '9999').localeCompare(String(b.internal_deadline || '9999')); }
function renderItem(i){
  const company = state.companies.find(c=>c.id===i.company_id);
  const overdue = isOverdue(i);
  return `<div class="item">
    <div class="item-main">
      <div class="item-title">${esc(i.title)}</div>
      <div class="item-meta">
        <span class="pill ${statusPill(i.status)}">${statusLabel(i.status)}</span>
        ${overdue?'<span class="pill red">Atrasado</span>':''}
        <span>${esc(i.channel || 'Sin canal')}</span>
        <span>Resp: ${esc(i.owner || 'Sin responsable')}</span>
        <span>Deadline: ${fmtDate(i.internal_deadline)}</span>
      </div>

    </div>
    <div class="item-actions"><button class="btn ghost sm" onclick="openContentModal('${i.id}')">Editar</button></div>
  </div>`;
}
function renderItemCompact(i){
  return `<div class="item">
    <div class="item-main">
      <div class="item-title">${esc(i.title)}</div>
      <div class="item-meta"><span class="pill ${statusPill(i.status)}">${statusLabel(i.status)}</span><span>${fmtDate(i.internal_deadline)}</span></div>
    </div>
    <div class="item-actions"><button class="btn ghost sm" onclick="openContentModal('${i.id}')">Abrir</button></div>
  </div>`;
}
function renderWeekBoard(items){
  const start = startOfWeek();
  const today = todayISO();
  return `<div class="week-grid">${Array.from({length:7}).map((_,idx)=>{
    const d = addDays(start, idx);
    const iso = toISODate(d);
    const dayItems = items.filter(i=>i.internal_deadline===iso);
    return `<div class="week-day ${iso===today?'today':''}">
      <div class="week-title">${DAYS[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}</div>
      ${dayItems.length ? dayItems.map(i=>`<div class="week-task ${isOverdue(i)?'overdue':''}" onclick="openContentModal('${i.id}')">${esc(i.title)}<br><span style="color:var(--muted)">${statusLabel(i.status)}</span></div>`).join('') : '<div class="item-desc">Sin tareas</div>'}
    </div>`;
  }).join('')}</div>`;
}
function renderAssetSummary(){
  const assets = filteredAssets();
  if(!assets.length) return `<div class="empty">Sin assets. Cargá logos, carpetas de Drive, referencias y manuales de marca.</div>`;
  const byType = Object.groupBy ? Object.groupBy(assets, a=>a.type || 'Otro') : assets.reduce((acc,a)=>((acc[a.type||'Otro']??=[]).push(a),acc),{});
  return `<div class="list">${Object.entries(byType).slice(0,6).map(([type,list])=>`<div class="item"><div class="item-main"><div class="item-title">${esc(type)}</div><div class="item-meta">${list.length} asset${list.length===1?'':'s'}</div></div></div>`).join('')}</div>`;
}

function renderCalendario(){
  const items = filteredItems();
  const pfx = String(currentMonth+1).padStart(2,'0');
  const firstDay = new Date(currentYear,currentMonth,1).getDay();
  const dim = new Date(currentYear,currentMonth+1,0).getDate();
  const prevMax = new Date(currentYear,currentMonth,0).getDate();
  const allEvents = items.flatMap(calendarEventsForItem);
  const noteEvents = monthNotes().filter(n=>n.date).map(n=>({kind:'note', note:n, date:n.date, phase:'nota', dates:[n.date], meta:PHASE_META.nota}));
  let cells = DAYS.map(d=>`<div class="cal-head">${d}</div>`).join('');
  for(let i=firstDay-1;i>=0;i--) cells += `<div class="cal-day other"><div class="cal-num">${prevMax-i}</div></div>`;
  for(let d=1; d<=dim; d++){
    const iso = `${currentYear}-${pfx}-${String(d).padStart(2,'0')}`;
    const dayEvents = [...allEvents, ...noteEvents].filter(e=>e.date===iso).sort((a,b)=>String(a.phase).localeCompare(String(b.phase)) || String(a.item?.title||a.note?.title).localeCompare(String(b.item?.title||b.note?.title)));
    cells += `<div class="cal-day" data-date="${iso}" ondragover="event.preventDefault()" ondrop="dropCalendarEvent(event,'${iso}')" ondblclick="openContentModal(null,'produccion','${iso}')">
      <div class="cal-num"><span>${d}</span><button class="cal-add" onclick="event.stopPropagation();openContentModal(null,'produccion','${iso}')">+</button></div>
      <div class="cal-events">${dayEvents.map(e=>renderCalendarEvent(e, iso)).join('')}</div>
    </div>`;
  }
  const rem = (firstDay + dim) % 7;
  for(let i=1;i<=(rem?7-rem:0);i++) cells += `<div class="cal-day other"><div class="cal-num">${i}</div></div>`;
  return `${renderStats()}
    <div class="panel">
      <div class="calendar-nav">
        <button class="btn ghost sm" onclick="changeMonth(-1)">← Anterior</button>
        <div><div class="calendar-title">${MONTHS[currentMonth]} ${currentYear}</div><div class="item-desc">Arrastrá una tarea para mover la fase. Si dura varios días, se mueve en bloque.</div></div>
        <button class="btn ghost sm" onclick="changeMonth(1)">Siguiente →</button>
      </div>
      <div class="calendar-legend">
        ${Object.entries(PHASE_META).filter(([k])=>k!=='nota').map(([k,m])=>`<span class="legend-dot ${m.cls}">${m.icon} ${m.label}</span>`).join('')}
      </div>
      <div class="calendar-wrap"><div class="calendar-grid">${cells}</div></div>
    </div>
    ${renderCalendarList(items)}
    ${renderMonthNotesPanel()}`;
}
function renderCalendarEvent(e, iso){
  const title = e.kind==='note' ? e.note.title : e.item.title;
  const open = e.kind==='note' ? `openNoteModal('${e.note.id}')` : `openContentModal('${e.item.id}')`;
  const seg = eventSegments(e.dates, iso);
  const cls = e.published ? PHASE_META.publicado.cls : e.meta.cls;
  const icon = e.published ? PHASE_META.publicado.icon : e.meta.icon;
  const phase = e.published ? 'publicacion' : e.phase;
  const dragId = e.kind==='note' ? e.note.id : e.item.id;
  return `<div class="cal-pill ${cls} ${seg}" draggable="true" ondragstart="dragCalendarEvent(event,'${e.kind}','${dragId}','${phase}')" onclick="event.stopPropagation();${open}" title="${escAttr(e.meta.label)} · ${escAttr(title)}">${icon} <strong>${esc(title)}</strong></div>`;
}
function renderCalendarList(items){
  const month = `${currentYear}-${String(currentMonth+1).padStart(2,'0')}`;
  const rows = items.filter(i=>String(principalCalendarDate(i)).startsWith(month)).sort((a,b)=>String(principalCalendarDate(a)).localeCompare(String(principalCalendarDate(b))));
  return `<div class="panel calendar-list-panel"><div class="panel-head"><div><div class="panel-title">Plan del mes en lista</div><div class="item-desc">Lectura rápida para cliente: fechas, canales, tipo y estado.</div></div></div>
    <div class="plan-table"><div class="plan-row plan-head"><div>Publicación estimada</div><div>Título</div><div>Plataforma</div><div>Tipo</div><div>Estado</div><div></div></div>
      ${rows.length ? rows.map(i=>`<div class="plan-row"><div>${fmtDate(i.publish_date || principalCalendarDate(i))}</div><div><strong>${esc(i.title)}</strong></div><div>${esc(i.channel || '-')}</div><div>${esc(i.content_type || '-')}</div><div><span class="pill ${statusPill(i.status)}">${statusLabel(i.status)}</span></div><div><button class="btn ghost sm" onclick="openContentModal('${i.id}')"><i class="fa-regular fa-eye"></i></button></div></div>`).join('') : `<div class="empty">Sin contenidos con fecha en este mes.</div>`}
    </div></div>`;
}
function renderMonthNotesPanel(){
  const notes = monthNotes();
  return `<div class="panel"><div class="panel-head"><div><div class="panel-title">Notas / pendientes de ${MONTHS[currentMonth]} ${currentYear}</div><div class="item-desc">Pendientes sin fecha o recordatorios del mes. Podés asignarles fecha para que aparezcan en calendario.</div></div><button class="btn primary sm" onclick="openNoteModal()"><i class="fa-solid fa-plus"></i> Nueva nota</button></div>
    ${notes.length ? `<div class="list">${notes.map((n,idx)=>`<div class="item note-item"><div class="item-main"><div class="item-title">${esc(n.title)}</div><div class="item-meta"><span>${n.date?`Fecha: ${fmtDate(n.date)}`:'Sin fecha'}</span></div>${n.notes?`<div class="item-desc">${esc(n.notes)}</div>`:''}</div><div class="item-actions"><button class="btn ghost sm" onclick="moveNote('${n.id}',-1)">↑</button><button class="btn ghost sm" onclick="moveNote('${n.id}',1)">↓</button><button class="btn ghost sm" onclick="openNoteModal('${n.id}')">Editar</button><button class="btn danger sm" onclick="deleteNote('${n.id}')">Eliminar</button></div></div>`).join('')}</div>` : `<div class="empty">Sin notas pendientes para este mes.</div>`}
  </div>`;
}
window.dragCalendarEvent = (event, kind, id, phase)=>{
  event.dataTransfer.setData('text/plain', JSON.stringify({kind,id,phase}));
};
window.dropCalendarEvent = async(event, targetDate)=>{
  event.preventDefault();
  let data;
  try{ data = JSON.parse(event.dataTransfer.getData('text/plain')); }catch{ return; }
  if(data.kind==='note'){
    const { error } = await sb.from('month_notes').update({date:targetDate, updated_by:session.user.id}).eq('id', data.id);
    if(error) return throwError(error);
    await loadAll(); render(); toast('Nota movida al calendario'); return;
  }
  const item = state.items.find(i=>i.id===data.id);
  if(!item) return;
  const currentDates = phaseDates(item, data.phase);
  const nextDates = currentDates.length ? currentDates.map(d=>shiftISODate(d, daysBetween(currentDates[0], targetDate))) : [targetDate];
  const payload = {...setPhasePayload(data.phase, nextDates), updated_by:session.user.id};
  const { error } = await sb.from('content_items').update(payload).eq('id', data.id);
  if(error) return throwError(error);
  await loadAll(); render(); toast('Fecha actualizada');
};
window.changeMonth = (delta)=>{ currentMonth += delta; if(currentMonth<0){currentMonth=11;currentYear--;} if(currentMonth>11){currentMonth=0;currentYear++;} render(); };

function renderKanban(){
  const items = filteredItems();
  return `<div class="panel"><div class="panel-head"><div class="panel-title">Tablero Kanban</div><button class="btn primary sm" onclick="openContentModal()"><i class="fa-solid fa-plus"></i> Nuevo</button></div>
  <div class="kanban">${STATUS.map(s=>{
    const cards = items.filter(i=>i.status===s.key);
    return `<div class="kanban-col"><div class="kanban-head"><div class="kanban-title">${s.label}</div><div class="kanban-count">${cards.length}</div></div>
      ${cards.map(renderKanbanCard).join('')}
      <button class="btn ghost sm full" onclick="openContentModal(null,'${s.key}')"><i class="fa-solid fa-plus"></i> Agregar</button>
    </div>`;
  }).join('')}</div></div>`;
}
function renderKanbanCard(i){
  return `<div class="kanban-card" onclick="openContentModal('${i.id}')">
    <div class="card-row"><span class="pill ${statusPill(i.status)}">${esc(i.channel || 'Canal')}</span>${isOverdue(i)?'<span class="pill red">Atrasado</span>':''}</div>
    <div class="card-title">${esc(i.title)}</div>
    <div class="item-meta"><span>${fmtDate(i.internal_deadline)}</span><span>${esc(i.owner || 'Sin responsable')}</span></div>

  </div>`;
}

function renderIdeas(){
  const ideas = filteredItems().filter(i=>i.status==='idea');
  return `<div class="panel">
    <div class="panel-head">
      <div><div class="panel-title">Banco de ideas</div><div class="item-desc">Ideas crudas, validadas, futuras y descartadas. Integrado al flujo de producción.</div></div>
      <div class="panel-actions"><button class="btn ghost sm" onclick="generateLocalIdeas()"><i class="fa-solid fa-wand-magic-sparkles"></i> Generar ideas rápidas</button><button class="btn primary sm" onclick="openContentModal(null,'idea')"><i class="fa-solid fa-plus"></i> Nueva idea</button></div>
    </div>
    <div class="idea-board">${IDEA_STAGES.map(stage=>{
      const list = ideas.filter(i=>(i.idea_stage||'cruda')===stage.key);
      return `<div class="idea-col"><div class="kanban-head"><div class="kanban-title">${stage.label}</div><div class="kanban-count">${list.length}</div></div>${list.map(renderKanbanCard).join('') || '<div class="empty">Sin ideas</div>'}</div>`;
    }).join('')}</div>
  </div>`;
}
window.generateLocalIdeas = async()=>{
  const company = companyById();
  const base = [
    `Antes y después real de ${company?.name || 'la marca'}`,
    `3 errores comunes que comete el cliente antes de contratar`,
    `Proceso explicado en 30 segundos`,
    `Caso práctico: problema, solución y resultado`,
    `Mito vs realidad aplicado al servicio`,
  ];
  const rows = base.map(title=>({
    company_id: currentCompanyId,
    title,
    description:'Idea generada automáticamente como disparador. Ajustar copy, formato y CTA.',
    status:'idea', idea_stage:'cruda', priority:'media', channel:'Instagram', content_type:'Reel',
    owner:'Compartido', created_by: session.user.id, updated_by: session.user.id
  }));
  const { error } = await sb.from('content_items').insert(rows);
  if(error) return throwError(error);
  await loadAll(); render(); toast('Ideas rápidas creadas');
};

function renderBiblioteca(){
  const assets = filteredAssets();
  const q = (window.__assetQ || '').toLowerCase();
  const t = window.__assetType || '';
  const filtered = assets.filter(a=>{
    const hay = [a.name,a.type,a.tags,a.usage,a.notes].join(' ').toLowerCase();
    return (!q || hay.includes(q)) && (!t || a.type===t);
  });
  return `<div class="panel">
    <div class="panel-head"><div><div class="panel-title">Biblioteca de assets</div><div class="item-desc">Links a logos, carpetas, referencias, manuales, fotos y videos.</div></div><button class="btn primary sm" onclick="openAssetModal()"><i class="fa-solid fa-plus"></i> Nuevo asset</button></div>
    <div class="filters"><input class="form-input" placeholder="Buscar asset..." oninput="window.__assetQ=this.value;render()" value="${escAttr(window.__assetQ||'')}" /><select class="form-input" onchange="window.__assetType=this.value;render()"><option value="">Todos los tipos</option>${ASSET_TYPES.map(x=>`<option ${x===(window.__assetType||'')?'selected':''}>${x}</option>`).join('')}</select></div>
    ${filtered.length ? `<div class="asset-grid">${filtered.map(renderAssetCard).join('')}</div>` : `<div class="empty">Sin assets cargados para esta empresa.</div>`}
  </div>`;
}
function renderAssetCard(a){
  return `<div class="asset-card">
    <div class="asset-icon"><i class="fa-solid ${assetIcon(a.type)}"></i></div>
    <div class="item-title">${esc(a.name)}</div>
    <div class="item-meta"><span class="pill blue">${esc(a.type || 'Otro')}</span>${a.tags?`<span>${esc(a.tags)}</span>`:''}</div>
    ${a.usage ? `<div class="item-desc"><strong>Uso:</strong> ${esc(a.usage)}</div>` : ''}
    ${a.notes ? `<div class="item-desc">${esc(a.notes)}</div>` : ''}
    <div class="item-actions" style="margin-top:12px">
      ${a.link_url ? `<a class="btn ghost sm" href="${escAttr(a.link_url)}" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir</a><button class="btn ghost sm" onclick="copyText('${escAttr(a.link_url)}')"><i class="fa-solid fa-copy"></i></button>` : ''}
      <button class="btn ghost sm" onclick="openAssetModal('${a.id}')">Editar</button>
      <button class="btn danger sm" onclick="deleteAsset('${a.id}')">Eliminar</button>
    </div>
  </div>`;
}
function assetIcon(type=''){
  const t = normalize(type);
  if(t.includes('logo')) return 'fa-shapes';
  if(t.includes('manual')) return 'fa-book';
  if(t.includes('foto')) return 'fa-image';
  if(t.includes('video')) return 'fa-video';
  if(t.includes('drive') || t.includes('carpeta')) return 'fa-folder';
  if(t.includes('copy')) return 'fa-file-lines';
  if(t.includes('plantilla')) return 'fa-layer-group';
  return 'fa-link';
}
window.copyText = async(text)=>{ await navigator.clipboard.writeText(text); toast('Link copiado'); };


function renderClientes(){
  if(!canViewClients()) return `<div class="empty">Acceso exclusivo de Ribera Audiovisual.</div>`;
  const q = (window.__prospectQ || '').toLowerCase();
  const st = window.__prospectStatus || '';
  const prospects = state.prospects.filter(p=>{
    const hay = [p.company_name,p.contact_name,p.email,p.phone,p.service_interest,p.status,p.notes,p.next_action].join(' ').toLowerCase();
    return (!q || hay.includes(q)) && (!st || p.status===st);
  });
  const active = state.prospects.filter(p=>!['Ganado','Perdido'].includes(p.status||'')).length;
  const won = state.prospects.filter(p=>p.status==='Ganado').length;
  const next = state.prospects.filter(p=>p.next_contact_date && p.next_contact_date <= todayISO() && !['Ganado','Perdido'].includes(p.status||'')).length;
  return `<div class="stats-grid">
      ${stat('Prospectos', state.prospects.length, 'fa-handshake', 'bg-blue', 'total cargado')}
      ${stat('Activos', active, 'fa-briefcase', 'bg-amber', 'en seguimiento')}
      ${stat('Ganados', won, 'fa-circle-check', 'bg-green', 'convertidos')}
      ${stat('Contactar hoy', next, 'fa-phone', 'bg-red', 'fecha de contacto vencida')}
    </div>
    <div class="panel">
      <div class="panel-head"><div><div class="panel-title">Posibles clientes</div><div class="item-desc">Pipeline comercial interno de Ribera Audiovisual. Solo visible para ${RIBERA_EMAIL}.</div></div><button class="btn primary sm" onclick="openProspectModal()"><i class="fa-solid fa-plus"></i> Nuevo prospecto</button></div>
      <div class="filters"><input class="form-input" placeholder="Buscar cliente, contacto, servicio..." oninput="window.__prospectQ=this.value;render()" value="${escAttr(window.__prospectQ||'')}" /><select class="form-input" onchange="window.__prospectStatus=this.value;render()"><option value="">Todos los estados</option>${PROSPECT_STATUSES.map(x=>`<option ${x===(window.__prospectStatus||'')?'selected':''}>${x}</option>`).join('')}</select></div>
      ${prospects.length ? `<div class="prospect-grid">${prospects.map(renderProspectCard).join('')}</div>` : `<div class="empty">Sin prospectos cargados.</div>`}
    </div>`;
}
function renderProspectCard(p){
  const stale = p.next_contact_date && p.next_contact_date <= todayISO() && !['Ganado','Perdido'].includes(p.status||'');
  return `<div class="prospect-card ${stale?'stale':''}">
    <div class="prospect-head"><div><div class="item-title">${esc(p.company_name)}</div><div class="item-meta"><span class="pill blue">${esc(p.status||'Prospecto')}</span>${stale?'<span class="pill red">Contactar</span>':''}</div></div><button class="btn ghost sm" onclick="openProspectModal('${p.id}')">Editar</button></div>
    <div class="item-desc"><strong>Contacto:</strong> ${esc(p.contact_name||'Sin contacto')} ${p.phone?`· ${esc(p.phone)}`:''} ${p.email?`· ${esc(p.email)}`:''}</div>
    <div class="item-desc"><strong>Interés:</strong> ${esc(p.service_interest||'Sin definir')}</div>
    ${p.next_action ? `<div class="item-desc"><strong>Próxima acción:</strong> ${esc(p.next_action)}</div>` : ''}
    ${p.next_contact_date ? `<div class="item-desc"><strong>Próximo contacto:</strong> ${fmtDate(p.next_contact_date)}</div>` : ''}
    ${p.link_url ? `<div class="item-actions" style="margin-top:10px"><a class="btn ghost sm" href="${escAttr(p.link_url)}" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i> Abrir link</a></div>` : ''}
  </div>`;
}

function renderMetricas(){
  const perCompany = visibleCompanies().map(c=>{
    const items = state.items.filter(i=>i.company_id===c.id);
    const assets = state.assets.filter(a=>a.company_id===c.id);
    return { c, m: calcMetrics(items), assets: assets.length };
  });
  return `${renderStats()}
    <div class="panel"><div class="panel-head"><div class="panel-title">Balance por empresa</div></div>
      <div class="list">${perCompany.map(({c,m,assets})=>`<div class="item">
        <div class="mini-logo" style="--company-dark:${companyMeta(c).dark}">${logoHTML(c)}</div>
        <div class="item-main"><div class="item-title">${esc(c.name)}</div><div class="item-meta"><span>${m.total} contenidos</span><span>${m.inProcess} en proceso</span><span>${m.overdue} atrasados</span><span>${assets} assets</span></div></div>
        <div class="item-actions"><button class="btn ghost sm" onclick="window.__enterCompany('${c.id}')">Entrar</button></div>
      </div>`).join('')}</div>
    </div>`;
}

function renderConfig(){
  const resp = state.responsibles.filter(r=>r.company_id===currentCompanyId);
  return `<div class="config-grid">
    <div class="panel"><div class="panel-head"><div><div class="panel-title">Empresas / clientes</div><div class="item-desc">Agregar, editar o eliminar empresas. Si borrás una con datos, se reasignan antes.</div></div><button class="btn primary sm" onclick="openCompanyModal()"><i class="fa-solid fa-plus"></i> Agregar</button></div>
      ${visibleCompanies().map(c=>renderCompanyRow(c)).join('') || '<div class="empty">Sin empresas visibles</div>'}
    </div>
    <div class="panel"><div class="panel-head"><div><div class="panel-title">Responsables</div><div class="item-desc">Creá o quitá responsables para esta empresa.</div></div><button class="btn primary sm" onclick="openResponsibleModal()"><i class="fa-solid fa-plus"></i> Agregar</button></div>
      ${resp.length ? resp.map(r=>`<div class="company-row"><div class="company-row-main"><div class="mini-logo">${esc(initials(r.name))}</div><div class="item-main"><div class="company-name">${esc(r.name)}</div></div></div><div class="item-actions"><button class="btn ghost sm" onclick="openResponsibleModal('${r.id}')">Editar</button><button class="btn danger sm" onclick="deleteResponsible('${r.id}')">Eliminar</button></div></div>`).join('') : '<div class="empty">Sin responsables. Se sugieren Nacho y Lilu.</div>'}
    </div>
    <div class="panel"><div class="panel-head"><div class="panel-title">Backups</div></div>
      <p class="item-desc">Supabase ya centraliza los datos, pero el backup JSON sirve como seguro adicional o migración rápida.</p>
      <div class="item-actions" style="margin-top:14px"><button class="btn ghost" onclick="exportBackup()"><i class="fa-solid fa-download"></i> Exportar backup</button><label class="btn ghost"><i class="fa-solid fa-upload"></i> Importar backup <input type="file" accept="application/json" style="display:none" onchange="importBackup(event)"></label></div>
    </div>
  </div>`;
}
function renderCompanyRow(c){
  const itemCount = state.items.filter(i=>i.company_id===c.id).length;
  const assetCount = state.assets.filter(a=>a.company_id===c.id).length;
  return `<div class="company-row">
    <div class="company-row-main"><div class="mini-logo">${logoHTML(c)}</div><div class="item-main"><div class="company-name">${esc(c.name)}</div><div class="company-sub">${itemCount} contenidos · ${assetCount} assets</div></div></div>
    <div class="item-actions"><button class="btn ghost sm" onclick="openCompanyModal('${c.id}')">Editar</button>${isRiberaCompany(c)?'<button class="btn ghost sm" disabled>Cuenta interna</button>':`<button class="btn danger sm" onclick="deleteCompany('${c.id}')">Eliminar</button>`}</div>
  </div>`;
}

function openModal(html){
  $('#modal-root').innerHTML = `<div class="modal-overlay" onclick="closeModal(event)">${html}</div>`;
}
window.closeModal = (event)=>{
  if(event && !event.target.classList.contains('modal-overlay')) return;
  $('#modal-root').innerHTML = '';
};
function modalShell(title, body, footer){
  return `<div class="modal" onclick="event.stopPropagation()"><div class="modal-head"><div class="modal-title">${title}</div><button class="btn ghost sm" onclick="closeModal()"><i class="fa-solid fa-xmark"></i></button></div><div class="modal-body">${body}</div><div class="modal-footer">${footer}</div></div>`;
}
function companyOptions(selected=currentCompanyId){
  return visibleCompanies().map(c=>`<option value="${c.id}" ${c.id===selected?'selected':''}>${esc(c.name)}</option>`).join('');
}
function openContentModal(id=null, status=null, defaultDate=''){
  const item = id ? state.items.find(i=>i.id===id) : null;
  const initialStatus = item?.status || status || 'idea';
  const ideaDate = item?.idea_date || (initialStatus==='idea' ? defaultDate : '');
  const productionDates = datesToInput(item?.production_dates || (initialStatus==='produccion' && defaultDate ? [defaultDate] : []));
  const editingDates = datesToInput(item?.editing_dates || (initialStatus==='edicion' && defaultDate ? [defaultDate] : []));
  const reviewDates = datesToInput(item?.review_dates || (initialStatus==='revision' && defaultDate ? [defaultDate] : []));
  const publishDate = item?.publish_date || (initialStatus==='publicado' ? defaultDate : '');
  const body = `<form id="content-form">
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Empresa</label><select class="form-input" name="company_id">${companyOptions(item?.company_id || currentCompanyId)}</select></div>
      <div class="form-group"><label class="form-label">Estado actual</label><select class="form-input" name="status">${STATUS.map(s=>`<option value="${s.key}" ${s.key===initialStatus?'selected':''}>${s.label}</option>`).join('')}</select></div>
      <div class="form-group span-2"><label class="form-label">Título</label><input class="form-input" name="title" required value="${escAttr(item?.title||'')}" placeholder="Ej: Reel educativo sobre..." /></div>
      <div class="form-group span-2"><label class="form-label">Descripción / concepto</label><textarea class="form-input" name="description" placeholder="Gancho, enfoque, CTA...">${esc(item?.description||'')}</textarea></div>
      <div class="form-group"><label class="form-label">Responsable</label><select class="form-input" name="owner">${ownerOptions(item?.owner||'')}</select></div>
      <div class="form-group"><label class="form-label">Deadline interno</label><input class="form-input" type="date" name="internal_deadline" value="${escAttr(item?.internal_deadline||'')}" /></div>
      <div class="form-group"><label class="form-label">Fecha de idea</label><input class="form-input" type="date" name="idea_date" value="${escAttr(ideaDate)}" /></div>
      <div class="form-group"><label class="form-label">Publicación estimada</label><input class="form-input" type="date" name="publish_date" value="${escAttr(publishDate)}" /></div>
      <div class="form-group span-2"><label class="form-label">Días de producción</label><textarea class="form-input compact-textarea" name="production_dates" placeholder="Ej: 2026-06-11, 2026-06-12 o días separados">${esc(productionDates)}</textarea><div class="field-hint">Podés usar días corridos o separados. Si son corridos, se conectan visualmente en el calendario.</div></div>
      <div class="form-group span-2"><label class="form-label">Días de edición</label><textarea class="form-input compact-textarea" name="editing_dates" placeholder="Ej: 2026-06-13, 2026-06-15">${esc(editingDates)}</textarea></div>
      <div class="form-group span-2"><label class="form-label">Días de revisión</label><textarea class="form-input compact-textarea" name="review_dates" placeholder="Ej: 2026-06-16, 2026-06-17">${esc(reviewDates)}</textarea></div>
      <div class="form-group"><label class="form-label">Canales</label><input class="form-input" name="channel" value="${escAttr(item?.channel||'')}" placeholder="Instagram, Reels, TikTok" /></div>
      <div class="form-group"><label class="form-label">Tipos de contenido</label><input class="form-input" name="content_type" value="${escAttr(item?.content_type||'')}" placeholder="Reel, historia, carrusel" /></div>
      <div class="form-group"><label class="form-label">Prioridad</label><select class="form-input" name="priority">${['alta','media','baja'].map(x=>`<option ${x===(item?.priority||'media')?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Etapa idea</label><select class="form-input" name="idea_stage"><option></option>${IDEA_STAGES.map(x=>`<option value="${x.key}" ${x.key===(item?.idea_stage||'cruda')?'selected':''}>${x.label}</option>`).join('')}</select></div>
      <div class="form-group span-2"><label class="form-label">Tags</label><input class="form-input" name="tags" value="${escAttr(item?.tags||'')}" placeholder="limpieza, institucional, campaña" /></div>
      <div class="form-group span-2"><label class="form-label">Link final / Drive</label><input class="form-input" name="link_url" type="url" value="${escAttr(item?.link_url||'')}" placeholder="https://..." /></div>
      <div class="form-group span-2"><label class="form-label">Desarrollo</label><textarea class="form-input" name="development" placeholder="Estructura, guión, visuales, notas de edición...">${esc(item?.development||'')}</textarea></div>
    </div>
  </form>`;
  const footer = `<button class="btn danger" ${item?'':'style="visibility:hidden"'} onclick="deleteContent('${item?.id||''}')"><i class="fa-solid fa-trash"></i> Eliminar</button><div class="modal-footer-right"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveContent('${item?.id||''}')"><i class="fa-solid fa-check"></i> Guardar</button></div>`;
  openModal(modalShell(item?'Editar contenido':'Nuevo contenido', body, footer));
}
window.openContentModal = openContentModal;
window.saveContent = async(id='')=>{
  const form = new FormData($('#content-form'));
  const payload = Object.fromEntries(form.entries());
  payload.tags = parseTags(payload.tags);
  payload.production_dates = parseDateInputList(payload.production_dates);
  payload.editing_dates = parseDateInputList(payload.editing_dates);
  payload.review_dates = parseDateInputList(payload.review_dates);
  payload.idea_date = payload.idea_date || null;
  payload.publish_date = payload.publish_date || null;
  payload.internal_deadline = payload.internal_deadline || null;
  payload.approved = null;
  payload.updated_by = session.user.id;
  if(!id) payload.created_by = session.user.id;
  if(!payload.title?.trim()){ toast('El título es obligatorio', 'error'); return; }
  if(!visibleCompanies().some(c=>c.id===payload.company_id)){ toast('No tenés acceso a esa empresa.', 'error'); return; }
  const query = id ? sb.from('content_items').update(payload).eq('id', id) : sb.from('content_items').insert(payload);
  const { error } = await query;
  if(error) return throwError(error);
  await loadAll(); closeModal(); render(); toast('Contenido guardado');
};
window.deleteContent = async(id)=>{
  if(!id || !confirm('¿Eliminar este contenido?')) return;
  const { error } = await sb.from('content_items').delete().eq('id', id);
  if(error) return throwError(error);
  await loadAll(); closeModal(); render(); toast('Contenido eliminado');
};


function openResponsibleModal(id=null){
  const r = id ? state.responsibles.find(x=>x.id===id) : null;
  const body = `<form id="responsible-form"><div class="form-group"><label class="form-label">Nombre</label><input class="form-input" name="name" required value="${escAttr(r?.name||'')}" placeholder="Nacho, Lilu..." /></div></form>`;
  const footer = `<button class="btn danger" ${r?'':'style="visibility:hidden"'} onclick="deleteResponsible('${r?.id||''}')">Eliminar</button><div class="modal-footer-right"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveResponsible('${r?.id||''}')">Guardar</button></div>`;
  openModal(modalShell(r?'Editar responsable':'Nuevo responsable', body, footer));
}
window.openResponsibleModal = openResponsibleModal;
window.saveResponsible = async(id='')=>{
  const payload = Object.fromEntries(new FormData($('#responsible-form')).entries());
  payload.company_id = currentCompanyId;
  if(!payload.name?.trim()) return toast('El nombre es obligatorio','error');
  const query = id ? sb.from('responsibles').update(payload).eq('id', id) : sb.from('responsibles').insert(payload);
  const { error } = await query;
  if(error) return throwError(error);
  await loadAll(); closeModal(); render(); toast('Responsable guardado');
};
window.deleteResponsible = async(id)=>{
  if(!id || !confirm('¿Eliminar responsable?')) return;
  const { error } = await sb.from('responsibles').delete().eq('id', id);
  if(error) return throwError(error);
  await loadAll(); closeModal(); render(); toast('Responsable eliminado');
};
function openNoteModal(id=null){
  const n = id ? state.month_notes.find(x=>x.id===id) : null;
  const body = `<form id="note-form"><div class="form-grid"><div class="form-group span-2"><label class="form-label">Título</label><input class="form-input" name="title" required value="${escAttr(n?.title||'')}" placeholder="Pendiente comercial, idea, ajuste..." /></div><div class="form-group"><label class="form-label">Fecha opcional</label><input class="form-input" type="date" name="date" value="${escAttr(n?.date||'')}" /></div><div class="form-group"><label class="form-label">Mes</label><input class="form-input" name="month_key" value="${escAttr(n?.month_key||monthKey())}" /></div><div class="form-group span-2"><label class="form-label">Notas</label><textarea class="form-input" name="notes">${esc(n?.notes||'')}</textarea></div></div></form>`;
  const footer = `<button class="btn danger" ${n?'':'style="visibility:hidden"'} onclick="deleteNote('${n?.id||''}')">Eliminar</button><div class="modal-footer-right"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveNote('${n?.id||''}')">Guardar</button></div>`;
  openModal(modalShell(n?'Editar nota':'Nueva nota mensual', body, footer));
}
window.openNoteModal = openNoteModal;
window.saveNote = async(id='')=>{
  const payload = Object.fromEntries(new FormData($('#note-form')).entries());
  payload.company_id = currentCompanyId;
  payload.date = payload.date || null;
  payload.updated_by = session.user.id;
  if(!id) payload.created_by = session.user.id;
  if(!payload.title?.trim()) return toast('El título es obligatorio','error');
  const query = id ? sb.from('month_notes').update(payload).eq('id', id) : sb.from('month_notes').insert(payload);
  const { error } = await query;
  if(error) return throwError(error);
  await loadAll(); closeModal(); render(); toast('Nota guardada');
};
window.deleteNote = async(id)=>{
  if(!id || !confirm('¿Eliminar nota?')) return;
  const { error } = await sb.from('month_notes').delete().eq('id', id);
  if(error) return throwError(error);
  await loadAll(); render(); toast('Nota eliminada');
};
window.moveNote = async(id,dir)=>{
  const note = state.month_notes.find(n=>n.id===id); if(!note) return;
  const next = (note.sort_order || 0) + dir;
  const { error } = await sb.from('month_notes').update({sort_order:next, updated_by:session.user.id}).eq('id', id);
  if(error) return throwError(error);
  await loadAll(); render();
};

function openAssetModal(id=null){
  const a = id ? state.assets.find(x=>x.id===id) : null;
  const body = `<form id="asset-form"><div class="form-grid">
    <div class="form-group"><label class="form-label">Empresa</label><select class="form-input" name="company_id">${companyOptions(a?.company_id || currentCompanyId)}</select></div>
    <div class="form-group"><label class="form-label">Tipo</label><select class="form-input" name="type">${ASSET_TYPES.map(x=>`<option ${x===(a?.type||'Otro')?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="form-group span-2"><label class="form-label">Nombre</label><input class="form-input" name="name" required value="${escAttr(a?.name||'')}" /></div>
    <div class="form-group span-2"><label class="form-label">Link</label><input class="form-input" name="link_url" type="url" value="${escAttr(a?.link_url||'')}" /></div>
    <div class="form-group span-2"><label class="form-label">Uso</label><input class="form-input" name="usage" value="${escAttr(a?.usage||'')}" placeholder="Para reels, branding, piezas comerciales..." /></div>
    <div class="form-group"><label class="form-label">Tags</label><input class="form-input" name="tags" value="${escAttr(a?.tags||'')}" /></div>
    <div class="form-group"><label class="form-label">Notas</label><input class="form-input" name="notes" value="${escAttr(a?.notes||'')}" /></div>
  </div></form>`;
  const footer = `<button class="btn danger" ${a?'':'style="visibility:hidden"'} onclick="deleteAsset('${a?.id||''}')"><i class="fa-solid fa-trash"></i> Eliminar</button><div class="modal-footer-right"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveAsset('${a?.id||''}')">Guardar</button></div>`;
  openModal(modalShell(a?'Editar asset':'Nuevo asset', body, footer));
}
window.openAssetModal = openAssetModal;
window.saveAsset = async(id='')=>{
  const payload = Object.fromEntries(new FormData($('#asset-form')).entries());
  payload.tags = parseTags(payload.tags);
  if(!payload.name?.trim()){ toast('El nombre es obligatorio', 'error'); return; }
  if(!visibleCompanies().some(c=>c.id===payload.company_id)){ toast('No tenés acceso a esa empresa.', 'error'); return; }
  const query = id ? sb.from('assets').update(payload).eq('id', id) : sb.from('assets').insert(payload);
  const { error } = await query;
  if(error) return throwError(error);
  await loadAll(); closeModal(); render(); toast('Asset guardado');
};
window.deleteAsset = async(id)=>{
  if(!id || !confirm('¿Eliminar este asset?')) return;
  const { error } = await sb.from('assets').delete().eq('id', id);
  if(error) return throwError(error);
  await loadAll(); closeModal(); render(); toast('Asset eliminado');
};

function openCompanyModal(id=null){
  const c = id ? state.companies.find(x=>x.id===id) : null;
  const body = `<form id="company-form"><div class="form-grid">
    <div class="form-group span-2"><label class="form-label">Nombre</label><input class="form-input" name="name" required value="${escAttr(c?.name||'')}" /></div>
    <div class="form-group"><label class="form-label">Color</label><input class="form-input" name="color" type="color" value="${escAttr(c?.color || colorForName(c?.name || 'Nueva empresa'))}" /></div>
    <div class="form-group"><label class="form-label">Logo URL</label><input class="form-input" name="logo_url" type="url" value="${escAttr(c?.logo_url||'')}" placeholder="https://..." /></div>
  </div></form>`;
  const footer = `<button class="btn danger" ${c?'':'style="visibility:hidden"'} onclick="deleteCompany('${c?.id||''}')"><i class="fa-solid fa-trash"></i> Eliminar</button><div class="modal-footer-right"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveCompany('${c?.id||''}')">Guardar</button></div>`;
  openModal(modalShell(c?'Editar empresa':'Nueva empresa', body, footer));
}
window.openCompanyModal = openCompanyModal;
window.saveCompany = async(id='')=>{
  const payload = Object.fromEntries(new FormData($('#company-form')).entries());
  if(!payload.name?.trim()){ toast('El nombre es obligatorio', 'error'); return; }
  if(normalize(payload.name)===normalize(RIBERA_COMPANY_NAME) && !isRiberaUser()){ toast('Ribera Audiovisual solo puede administrarse desde el usuario autorizado.', 'error'); return; }
  const query = id ? sb.from('companies').update(payload).eq('id', id) : sb.from('companies').insert(payload);
  const { error } = await query;
  if(error) return throwError(error);
  await loadAll(); closeModal(); render(); toast('Empresa guardada');
};
window.deleteCompany = async(id)=>{
  if(!id) return;
  const company = state.companies.find(c=>c.id===id);
  if(!company) return;
  if(isRiberaCompany(company)){ toast('Ribera Audiovisual es una cuenta interna fija. No se elimina.', 'error'); return; }
  const visible = visibleCompanies();
  if(visible.length <= 1){ toast('Debe quedar al menos una empresa visible.', 'error'); return; }
  const affectedItems = state.items.filter(i=>i.company_id===id).length;
  const affectedAssets = state.assets.filter(a=>a.company_id===id).length;
  const fallback = visible.find(c=>c.id!==id);
  const msg = `¿Eliminar "${company.name}"? ${affectedItems} contenidos y ${affectedAssets} assets se reasignarán a "${fallback.name}".`;
  if(!confirm(msg)) return;
  if(affectedItems){
    const { error } = await sb.from('content_items').update({company_id:fallback.id, updated_by: session.user.id}).eq('company_id', id);
    if(error) return throwError(error);
  }
  if(affectedAssets){
    const { error } = await sb.from('assets').update({company_id:fallback.id}).eq('company_id', id);
    if(error) return throwError(error);
  }
  const { error } = await sb.from('companies').delete().eq('id', id);
  if(error) return throwError(error);
  if(currentCompanyId === id){
    currentCompanyId = fallback.id;
    localStorage.setItem(`${STORAGE_PREFIX}_company`, currentCompanyId);
  }
  await loadAll(); closeModal(); render(); toast('Empresa eliminada');
};


function openProspectModal(id=null){
  if(!canViewClients()){ toast('Acceso exclusivo de Ribera Audiovisual.', 'error'); return; }
  const p = id ? state.prospects.find(x=>x.id===id) : null;
  const body = `<form id="prospect-form"><div class="form-grid">
    <div class="form-group span-2"><label class="form-label">Empresa / cliente potencial</label><input class="form-input" name="company_name" required value="${escAttr(p?.company_name||'')}" placeholder="Nombre de la empresa" /></div>
    <div class="form-group"><label class="form-label">Contacto</label><input class="form-input" name="contact_name" value="${escAttr(p?.contact_name||'')}" /></div>
    <div class="form-group"><label class="form-label">Canal de contacto</label><input class="form-input" name="contact_channel" value="${escAttr(p?.contact_channel||'')}" placeholder="LinkedIn, referido, web..." /></div>
    <div class="form-group"><label class="form-label">Teléfono</label><input class="form-input" name="phone" value="${escAttr(p?.phone||'')}" /></div>
    <div class="form-group"><label class="form-label">Email</label><input class="form-input" name="email" type="email" value="${escAttr(p?.email||'')}" /></div>
    <div class="form-group"><label class="form-label">Servicio de interés</label><select class="form-input" name="service_interest"><option></option>${PROSPECT_INTERESTS.map(x=>`<option ${x===(p?.service_interest||'')?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Estado</label><select class="form-input" name="status">${PROSPECT_STATUSES.map(x=>`<option ${x===(p?.status||'Prospecto')?'selected':''}>${x}</option>`).join('')}</select></div>
    <div class="form-group"><label class="form-label">Valor estimado</label><input class="form-input" name="estimated_value" type="number" min="0" step="1" value="${escAttr(p?.estimated_value||'')}" /></div>
    <div class="form-group"><label class="form-label">Próximo contacto</label><input class="form-input" name="next_contact_date" type="date" value="${escAttr(p?.next_contact_date||'')}" /></div>
    <div class="form-group span-2"><label class="form-label">Próxima acción</label><input class="form-input" name="next_action" value="${escAttr(p?.next_action||'')}" placeholder="Enviar propuesta, pedir reunión, mandar portfolio..." /></div>
    <div class="form-group span-2"><label class="form-label">Link</label><input class="form-input" name="link_url" type="url" value="${escAttr(p?.link_url||'')}" placeholder="Drive, CRM, sitio, propuesta..." /></div>
    <div class="form-group span-2"><label class="form-label">Notas</label><textarea class="form-input" name="notes">${esc(p?.notes||'')}</textarea></div>
  </div></form>`;
  const footer = `<button class="btn danger" ${p?'':'style="visibility:hidden"'} onclick="deleteProspect('${p?.id||''}')"><i class="fa-solid fa-trash"></i> Eliminar</button><div class="modal-footer-right"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveProspect('${p?.id||''}')">Guardar</button></div>`;
  openModal(modalShell(p?'Editar posible cliente':'Nuevo posible cliente', body, footer));
}
window.openProspectModal = openProspectModal;
window.saveProspect = async(id='')=>{
  if(!canViewClients()){ toast('Acceso exclusivo de Ribera Audiovisual.', 'error'); return; }
  const payload = Object.fromEntries(new FormData($('#prospect-form')).entries());
  if(!payload.company_name?.trim()){ toast('El nombre de empresa es obligatorio.', 'error'); return; }
  payload.estimated_value = payload.estimated_value ? Number(payload.estimated_value) : null;
  payload.updated_by = session.user.id;
  if(!id) payload.created_by = session.user.id;
  const query = id ? sb.from('prospects').update(payload).eq('id', id) : sb.from('prospects').insert(payload);
  const { error } = await query;
  if(error) return throwError(error);
  await loadAll(); closeModal(); render(); toast('Posible cliente guardado');
};
window.deleteProspect = async(id)=>{
  if(!id || !confirm('¿Eliminar este posible cliente?')) return;
  const { error } = await sb.from('prospects').delete().eq('id', id);
  if(error) return throwError(error);
  await loadAll(); closeModal(); render(); toast('Posible cliente eliminado');
};

window.exportBackup = ()=>{
  const data = JSON.stringify({ version:1, exported_at:new Date().toISOString(), companies:state.companies, content_items:state.items, assets:state.assets, prospects:state.prospects }, null, 2);
  const blob = new Blob([data], {type:'application/json'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cleanit-content-hub-backup-${todayISO()}.json`;
  a.click();
};
window.importBackup = async(event)=>{
  const file = event.target.files?.[0];
  if(!file) return;
  const text = await file.text();
  const data = JSON.parse(text);
  if(!confirm('Esto insertará datos del backup en Supabase. No borra lo existente. ¿Continuar?')) return;
  if(Array.isArray(data.companies)){
    const companies = data.companies.map(({id,created_at,updated_at,...rest})=>rest).filter(x=>x.name);
    if(companies.length){ const { error } = await sb.from('companies').upsert(companies, {onConflict:'name'}); if(error) return throwError(error); }
  }
  if(isRiberaUser() && Array.isArray(data.prospects)){
    const prospects = data.prospects.map(({id,created_at,updated_at,...rest})=>rest).filter(x=>x.company_name);
    if(prospects.length){ const { error } = await sb.from('prospects').insert(prospects); if(error) return throwError(error); }
  }
  await loadAll(); render(); toast('Backup importado parcialmente. Revisá empresas y contenido.');
};

init();
