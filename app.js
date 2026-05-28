'use strict';

const STORAGE_PREFIX = 'ribera_supabase_content_hub';
const APP_BUILD = 'final-104-cliente-aprueba-ribera-publica-zip-completo-202605';
const RIBERA_EMAIL = 'ribera.audiovisuales@gmail.com';
const RIBERA_COMPANY_NAME = 'Ribera Audiovisual';
const RIBERA_LOGO_PATH = 'ribera-logo.png';
const RIBERA_BRAND = { color:'#0b0b0d', dark:'#e31313', soft:'#f8e9e9', logo:RIBERA_LOGO_PATH };
const KNOWN_BRANDS = {
  'clean it': { color:'#1a6ff4', dark:'#1259d0', soft:'#eaf2ff' },
  'mundo chipa': { color:'#f28c28', dark:'#d46c11', soft:'#fff3e8' },
  'la clasica': { color:'#2f7d5a', dark:'#1f6a4f', soft:'#eaf6f0' },
  'ribera audiovisual': RIBERA_BRAND
};
const DEFAULT_COLORS = ['#1a6ff4', '#f28c28', '#2f7d5a', '#7c3aed', '#dc2626', '#0891b2', '#d97706', '#db2777'];
const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const STATUS = [
  {key:'idea', label:'Idea', pill:'amber'},
  {key:'produccion', label:'En producción', pill:'blue'},
  {key:'revision', label:'En revisión', pill:'violet'},
  {key:'publicado', label:'Publicado', pill:'green'}
];
const IDEA_STAGES = [
  {key:'cruda', label:'Crudas'},
  {key:'validada', label:'Validadas'},
  {key:'futura', label:'Futuras'},
  {key:'descartada', label:'Descartadas'}
];
const NEXT_ACTIONS = ['Definir idea','Escribir copy','Diseñar pieza','Editar video','Buscar material','Grabar','Revisar','Pedir aprobación','Publicar','Cerrar con link'];
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
let state = { companies: [], items: [], assets: [], prospects: [], profiles: [], access: [], assetLinks: [], comments: [], deliverables: [] };
let isBusy = false;
let appBooted = false;
let lastAuthEvent = '';

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));
const esc = (v='') => String(v ?? '').replace(/[&<>"]/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[s]));
const escAttr = esc;
const todayISO = () => new Date().toISOString().slice(0,10);
const toISODate = d => d ? new Date(d).toISOString().slice(0,10) : '';
const parseTags = v => (v || '').split(',').map(x=>x.trim()).filter(Boolean).join(', ');
const normalize = v => String(v||'').trim().toLowerCase();
const normalizeKey = normalize;
const isRiberaUser = () => normalize(session?.user?.email) === normalize(RIBERA_EMAIL);
const isRiberaCompany = (company) => normalize(company?.name) === normalize(RIBERA_COMPANY_NAME);
function currentProfile(){ return state.profiles.find(p => p.user_id === session?.user?.id) || null; }
function isAdminUser(){ return isRiberaUser() || currentProfile()?.role === 'admin_ribera'; }
function hasRiberaAccess(){ return isAdminUser() || !!currentProfile()?.ribera_access; }
function canManageCompanies(){ return isAdminUser() || !!currentProfile()?.can_manage_companies; }
function canDeleteRecords(){ return isAdminUser() || !!currentProfile()?.can_delete; }
function companyRole(companyId=currentCompanyId){
  if(isAdminUser()) return 'admin';
  return state.access.find(a => a.user_id === session?.user?.id && a.company_id === companyId)?.role || '';
}
function canReadCompany(companyId=currentCompanyId){ return isAdminUser() || !!companyRole(companyId); }
function canEditCompanyData(companyId=currentCompanyId){ return ['admin','editor'].includes(companyRole(companyId)); }
function canAdminCompany(companyId=currentCompanyId){ return isAdminUser() || companyRole(companyId) === 'admin'; }
function visibleCompanies(){ return state.companies.filter(c => hasRiberaAccess() || !isRiberaCompany(c)); }
function riberaCompany(){ return state.companies.find(isRiberaCompany) || null; }
function canViewClients(){ return hasRiberaAccess() && isRiberaCompany(companyById()); }
function updateAccessUI(){
  const nav = $('#nav-clientes');
  if(nav) nav.classList.toggle('hidden', !canViewClients());
  const newBtn = $('#new-content-btn');
  if(newBtn){
    const canCreate = !!currentCompanyId && canEditCompanyData(currentCompanyId);
    newBtn.disabled = !canCreate;
    newBtn.title = canCreate ? 'Nuevo contenido' : 'No tenés permiso de edición para esta empresa';
  }
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
  const preset = KNOWN_BRANDS[normalizeKey(c?.name || '')] || null;
  const color = preset?.color || c?.color || colorForName(c?.name || 'Clean It');
  const dark = preset?.dark || color;
  const soft = preset?.soft || softColor(color);
  const logo = c?.logo_url || preset?.logo || '';
  return { color, dark, soft, logo, initials: initials(c?.name || 'Clean It') };
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
function itemPublishStart(item){ return item?.publish_date || ''; }
function itemPublishEnd(item){ return item?.publish_end_date || item?.publish_date || ''; }
function itemPrimaryDate(item){
  return item?.publish_date || item?.production_start_date || item?.review_start_date || item?.idea_start_date || item?.internal_deadline || '';
}
function isPublishedOnDate(item, iso){
  const start = itemPublishStart(item);
  if(!start) return false;
  const end = itemPublishEnd(item) || start;
  return iso >= start && iso <= end;
}
function rangePosition(item, iso){
  const start = itemPublishStart(item);
  const end = itemPublishEnd(item) || start;
  if(!start || start === end) return 'single';
  if(iso === start) return 'start';
  if(iso === end) return 'end';
  return 'mid';
}
function calendarStatusIcon(status){
  return ({idea:'💡', produccion:'🎬', revision:'👁️', publicado:'✅'})[status] || '📌';
}
function renderCalendarPill(item, iso, kind='publish'){
  const pos = kind === 'publish' ? rangePosition(item, iso) : 'single';
  const title = kind === 'deadline' ? `Deadline interno: ${item.title}` : item.title;
  const labelPrefix = kind === 'deadline' ? '⏱' : calendarStatusIcon(item.status);
  const rangeMark = kind === 'publish' && pos === 'start' ? '▶ ' : kind === 'publish' && pos === 'mid' ? '━ ' : kind === 'publish' && pos === 'end' ? '◀ ' : '';
  return `<span class="cal-pill ${kind==='deadline'?'deadline':`status-${item.status}`} range-${pos}" onclick="event.stopPropagation();openContentModal('${item.id}')" title="${escAttr(title)}">${labelPrefix} ${rangeMark}${esc(item.title)}</span>`;
}

function safeArray(v){
  if(Array.isArray(v)) return v.filter(Boolean);
  if(!v) return [];
  return String(v).split(',').map(x=>x.trim()).filter(Boolean);
}
function itemChannels(item){
  const list = safeArray(item?.channels);
  return list.length ? list : (item?.channel ? [item.channel] : []);
}
function itemTypes(item){
  const list = safeArray(item?.content_types);
  return list.length ? list : (item?.content_type ? [item.content_type] : []);
}
function labelList(list, fallback='-'){
  const arr = safeArray(list);
  return arr.length ? arr.map(esc).join(', ') : fallback;
}
function monthKey(date=new Date()){
  if(typeof date === 'string') return date.slice(0,7);
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
}
function monthLabel(ym){
  if(!ym || !/^\d{4}-\d{2}$/.test(ym)) return 'Todos los meses';
  const [y,m]=ym.split('-');
  return `${MONTHS[Number(m)-1]} ${y}`;
}
function dateInMonth(date, ym){ return !!date && (!ym || String(date).startsWith(ym)); }
function rangeOverlapsMonth(start, end, ym){
  if(!ym) return true;
  if(!start && !end) return false;
  const monthStart = `${ym}-01`;
  const lastDay = new Date(Number(ym.slice(0,4)), Number(ym.slice(5,7)), 0).getDate();
  const monthEnd = `${ym}-${String(lastDay).padStart(2,'0')}`;
  const s = start || end;
  const e = end || start || s;
  return s <= monthEnd && e >= monthStart;
}
function itemInMonth(item, ym){
  if(!ym) return true;
  return dateInMonth(item.internal_deadline, ym) ||
    rangeOverlapsMonth(item.publish_date, item.publish_end_date || item.publish_date, ym) ||
    rangeOverlapsMonth(item.idea_start_date, item.idea_end_date || item.idea_start_date, ym) ||
    rangeOverlapsMonth(item.production_start_date, item.production_end_date || item.production_start_date, ym) ||
    rangeOverlapsMonth(item.review_start_date, item.review_end_date || item.review_start_date, ym);
}
function isOnRange(iso, start, end){
  if(!start) return false;
  const e = end || start;
  return iso >= start && iso <= e;
}
function renderPhasePill(item, iso){
  const phases = [
    {key:'idea', label:'Idea', icon:'💡', cls:'phase-idea', start:item.idea_start_date, end:item.idea_end_date},
    {key:'prod', label:'Producción', icon:'🎬', cls:'phase-prod', start:item.production_start_date, end:item.production_end_date},
    {key:'rev', label:'Edición/Revisión', icon:'✂️', cls:'phase-review', start:item.review_start_date, end:item.review_end_date},
  ].filter(p=>isOnRange(iso,p.start,p.end));
  return phases.map(p=>`<span class="cal-pill ${p.cls}" onclick="event.stopPropagation();openContentModal('${item.id}')" title="${escAttr(p.label + ': ' + item.title)}">${p.icon} ${esc(item.title)}</span>`).join('');
}
function contentAssetLinks(itemId){ return state.assetLinks.filter(l=>l.content_item_id===itemId); }
function contentAssets(itemId){
  const ids = new Set(contentAssetLinks(itemId).map(l=>l.asset_id));
  return state.assets.filter(a=>ids.has(a.id));
}
function contentComments(itemId){ return state.comments.filter(c=>c.content_item_id===itemId).sort((a,b)=>String(a.created_at).localeCompare(String(b.created_at))); }
function contentDeliverables(itemId){ return state.deliverables.filter(d=>d.content_item_id===itemId).sort((a,b)=>String(b.created_at).localeCompare(String(a.created_at))); }
function listArray(item, field){
  const raw = item?.[field];
  if(Array.isArray(raw)) return raw.filter(x=>x && String(x.text||'').trim());
  if(typeof raw === 'string'){
    try {
      const parsed = JSON.parse(raw);
      if(Array.isArray(parsed)) return parsed.filter(x=>x && String(x.text||'').trim());
    } catch {}
  }
  return [];
}
function renderListEditor(editorId, items, placeholder, addLabel){
  return `<div class="structured-list-editor" id="${escAttr(editorId)}">
    ${items.map(item=>renderListRow(item, placeholder)).join('')}
    <button type="button" class="btn ghost sm list-add-btn" onclick="addStructuredListRow('${escAttr(editorId)}','${escAttr(placeholder)}')">+ ${esc(addLabel)}</button>
  </div>`;
}
function renderListRow(item={}, placeholder='Agregar ítem'){
  return `<div class="structured-list-row">
    <input type="checkbox" class="structured-list-done" ${item.done?'checked':''}>
    <input class="form-input structured-list-text" value="${escAttr(item.text||'')}" placeholder="${escAttr(placeholder)}">
    <button type="button" class="btn ghost sm row-remove-btn" onclick="removeStructuredListRow(this)" title="Quitar"><i class="fa-solid fa-xmark"></i></button>
  </div>`;
}
function checkboxGrid(name, options, selected){
  const set = new Set(safeArray(selected));
  return `<div class="check-grid">${options.map(opt=>`<label class="check-pill"><input type="checkbox" name="${escAttr(name)}" value="${escAttr(opt)}" ${set.has(opt)?'checked':''}> <span>${esc(opt)}</span></label>`).join('')}</div>`;
}
function mediaEmbedUrl(url){
  const u = String(url||'').trim();
  if(!u) return '';
  const yt = u.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([A-Za-z0-9_-]+)/);
  if(yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const drive = u.match(/drive\.google\.com\/file\/d\/([^/]+)/) || u.match(/[?&]id=([^&]+)/);
  if(drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  return u;
}
function renderMediaPreview(url){
  const u = String(url||'').trim();
  if(!u) return '';
  const embed = mediaEmbedUrl(u);
  if(/\.(mp4|webm|ogg)(\?.*)?$/i.test(u)) return `<video class="deliverable-player" src="${escAttr(u)}" controls preload="metadata"></video>`;
  if(/\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(u)) return `<img class="deliverable-image" src="${escAttr(u)}" alt="Entregable" loading="lazy" />`;
  if(embed !== u || /youtube\.com\/embed\//.test(embed)) return `<iframe class="deliverable-frame" src="${escAttr(embed)}" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>`;
  return `<div class="empty small">Vista previa no disponible. Usá “Abrir” para verlo.</div>`;
}
function statusFlowIndex(status){ return ({idea:0, produccion:1, revision:2, publicado:3})[status] ?? 0; }
function renderContentFlow(item){
  const idx = statusFlowIndex(item?.status || 'idea');
  const steps = [
    {label:'Idea', icon:'💡'},
    {label:'Producción', icon:'🎬'},
    {label:'Edición / revisión', icon:'✂️'},
    {label:'Terminado', icon:'✅'},
  ];
  return `<div class="client-section"><div class="client-section-title">Estado del contenido</div><div class="status-line">${steps.map((s,i)=>`<div class="status-step ${i<idx?'done':i===idx?'active':''}"><div class="status-dot">${i<idx?'✓':s.icon}</div><div class="status-label">${s.label}</div></div>`).join('')}</div></div>`;
}
function renderApprovalMini(item){
  const status = item?.status || 'idea';
  const isIdea = status === 'idea';
  const isProduction = status === 'produccion';
  const isReview = status === 'revision';
  const isPublished = status === 'publicado';
  const clientPieceApproved = !!(item?.client_piece_approved_at || item?.client_approved_at || item?.piece_approved_at);
  const steps = [
    {label:'Idea aprobada por cliente', ok:!isIdea, active:isIdea},
    {label:'Pieza aprobada por cliente', ok:clientPieceApproved || isPublished, active:isReview && !clientPieceApproved},
    {label:'Publicado por Ribera', ok:isPublished, active:(clientPieceApproved && !isPublished)},
  ];
  let actions = '';
  if(isIdea){
    actions = `<button class="btn primary sm" onclick="approveIdeaAndMove('${item.id}')"><i class="fa-solid fa-check"></i> Aprobar idea y pasar a producción</button>`;
  } else if(isProduction){
    actions = `<button class="btn ghost sm" onclick="moveContentToReview('${item.id}')"><i class="fa-solid fa-scissors"></i> Pasar a edición / revisión</button>`;
  } else if(isReview && !clientPieceApproved){
    actions = `<button class="btn primary sm" onclick="clientApprovePiece('${item.id}')"><i class="fa-solid fa-check-double"></i> Cliente aprobó pieza</button>`;
  } else if((isReview && clientPieceApproved) || (!isPublished && clientPieceApproved)){
    actions = `<span class="pill green">Cliente aprobó</span><button class="btn primary sm" onclick="publishApprovedContent('${item.id}')"><i class="fa-solid fa-upload"></i> Marcar publicado por Ribera</button>`;
  } else {
    actions = `<span class="pill green">Publicado por Ribera</span>`;
  }
  return `<div class="client-section approval-client-section">
    <div class="panel-head mini"><div><div class="client-section-title">Aprobación cliente</div><div class="item-desc">El cliente aprueba la idea para pasar a producción. Luego aprueba la pieza en revisión. El estado “Publicado” lo marca Ribera.</div></div><div class="approval-actions">${actions}</div></div>
    <div class="approval-line approval-client-line">${steps.map(s=>`<div class="approval-node ${s.ok?'ok':s.active?'active':''}"><span>${s.ok?'✓':s.active?'•':'○'}</span><small>${s.label}</small></div>`).join('')}</div>
  </div>`;
}
function renderDeliverablesPanel(item){
  if(!item) return `<div class="client-section"><div class="client-section-title">📦 Entregables</div><div class="empty">Guardá el contenido para cargar entregables y ver reproductor.</div></div>`;
  const list = contentDeliverables(item.id);
  const primary = item.link_url && !list.some(d=>d.link_url===item.link_url) ? [{id:'primary',title:'Link final / Drive',link_url:item.link_url,status:item.status,version_label:'Principal'}] : [];
  const all = [...primary, ...list];
  return `<div class="client-section"><div class="panel-head mini"><div><div class="client-section-title">📦 Entregables</div><div class="item-desc">${all.length} versión${all.length===1?'':'es'}</div></div></div>
    ${all.length ? all.map(renderDeliverableCard).join('') : '<div class="empty">Sin entregables cargados.</div>'}
    <div class="deliverable-form">
      <input class="form-input" id="new-deliverable-title" placeholder="Nombre del entregable" />
      <input class="form-input" id="new-deliverable-url" placeholder="Link Drive, YouTube o MP4" />
      <select class="form-input" id="new-deliverable-status"><option>Aprobado</option><option>En revisión</option><option>Publicado</option><option>Borrador</option></select>
      <button class="btn ghost sm" onclick="addDeliverable('${item.id}')">Agregar entregable</button>
    </div>
  </div>`;
}
function renderDeliverableCard(d){
  return `<div class="deliverable-card">
    <div class="deliverable-main">
      <div class="deliverable-icon"><i class="fa-solid fa-file-video"></i></div>
      <div><div class="item-title">${esc(d.title || 'Entregable')}</div><div class="item-meta"><span>${esc(d.version_label || '')}</span><span>${esc(d.status || '')}</span></div></div>
    </div>
    ${renderMediaPreview(d.link_url)}
    <div class="item-actions"><a class="btn ghost sm" href="${escAttr(d.link_url)}" target="_blank">Abrir</a>${d.id!=='primary'?`<button class="btn danger sm" onclick="deleteDeliverable('${d.id}')">Eliminar</button>`:''}</div>
  </div>`;
}
function renderAssociatedAssetsPanel(item){
  if(!item) return '';
  const linked = contentAssets(item.id);
  return `<div class="client-section"><div class="client-section-title">🗂️ Assets asociados</div>
    ${linked.length ? `<div class="asset-grid compact">${linked.map(a=>renderAssetCard(a)).join('')}</div>` : '<div class="empty">Sin assets asociados todavía.</div>'}
  </div>`;
}
function renderCommentsPanel(item){
  if(!item) return '';
  const comments = contentComments(item.id);
  return `<div class="client-section"><div class="client-section-title">💬 Comentarios</div>
    ${comments.length ? `<div class="comments-list">${comments.map(c=>`<div class="comment"><div><strong>${esc(c.created_by_email || 'Equipo')}</strong><span>${new Date(c.created_at).toLocaleString('es-AR')}</span></div><p>${esc(c.body)}</p></div>`).join('')}</div>` : '<div class="empty">Sin comentarios.</div>'}
    <div class="comment-add"><textarea class="form-input" id="new-comment-body" placeholder="Agregar comentario interno..."></textarea><button class="btn ghost sm" onclick="addContentComment('${item.id}')">Comentar</button></div>
  </div>`;
}
function renderAssetPicker(item){
  const assets = state.assets.filter(a=>a.company_id===(item?.company_id || currentCompanyId));
  const selected = new Set(item ? contentAssetLinks(item.id).map(l=>l.asset_id) : []);
  if(!assets.length) return '<div class="empty small">No hay assets en la biblioteca de esta empresa.</div>';
  return `<div class="asset-picker">${assets.map(a=>`<label class="asset-pick"><input type="checkbox" name="asset_ids" value="${escAttr(a.id)}" ${selected.has(a.id)?'checked':''}><span><strong>${esc(a.name)}</strong><small>${esc(a.type||'Asset')}</small></span></label>`).join('')}</div>`;
}
function getMonthItems(items, ym){ return items.filter(i=>itemInMonth(i, ym)); }

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
    lastAuthEvent = event;
    session = newSession;
    if(!session){
      appBooted = false;
      showAuth();
      return;
    }

    // Supabase refreshes the session when the browser tab regains focus.
    // Before this guard, that refresh re-ran bootApp() and sent the user back
    // to the company selector. We only boot when the app is not already active.
    const appVisible = !$('#app')?.classList.contains('hidden');
    const gateVisible = !$('#company-gate')?.classList.contains('hidden');
    if(appBooted && appVisible && !gateVisible){
      return;
    }
    bootApp({ showSelector: !currentCompanyId });
  });
  if(session) bootApp({ showSelector: !currentCompanyId }); else showAuth();
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
async function bootApp(options={}){
  const showSelector = options.showSelector !== false;
  hide($('#setup-screen')); hide($('#auth-screen'));
  $('#user-email').textContent = session?.user?.email || 'usuario';
  $('#user-avatar').textContent = initials(session?.user?.email || 'U').slice(0,1);
  await loadAll();
  if(!state.companies.length && isAdminUser()) await ensureDefaultCompanies();
  if(isAdminUser() && !riberaCompany()) await ensureRiberaCompany();
  const availableCompanies = visibleCompanies();
  if(!currentCompanyId || !availableCompanies.some(c=>c.id===currentCompanyId)) currentCompanyId = availableCompanies[0]?.id || '';
  localStorage.setItem(`${STORAGE_PREFIX}_company`, currentCompanyId);
  appBooted = true;
  subscribeChanges();
  if(showSelector || !currentCompanyId){
    renderCompanyGate();
  } else {
    hide($('#company-gate'));
    show($('#app'));
    applyCompanyTheme();
    render();
  }
}
async function ensureDefaultCompanies(){
  const defaults = [
    { name:'Clean It', color:'#1a6ff4' },
    { name:'Mundo Chipa', color:'#f28c28' },
    { name:'La Clasica', color:'#2f7d5a' },
    ...(isRiberaUser() ? [{ name:RIBERA_COMPANY_NAME, color:RIBERA_BRAND.color, logo_url:RIBERA_LOGO_PATH }] : [])
  ];
  const { error } = await sb.from('companies').upsert(defaults, { onConflict:'name' });
  if(error) throwError(error);
  await loadAll();
}
async function ensureRiberaCompany(){
  if(!isRiberaUser()) return;
  const { error } = await sb.from('companies').upsert([{ name:RIBERA_COMPANY_NAME, color:RIBERA_BRAND.color, logo_url:RIBERA_LOGO_PATH }], { onConflict:'name' });
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
    .on('postgres_changes', {event:'*', schema:'public', table:'user_profiles'}, debounceReload)
    .on('postgres_changes', {event:'*', schema:'public', table:'user_company_access'}, debounceReload)
    .on('postgres_changes', {event:'*', schema:'public', table:'content_asset_links'}, debounceReload)
    .on('postgres_changes', {event:'*', schema:'public', table:'content_comments'}, debounceReload)
    .on('postgres_changes', {event:'*', schema:'public', table:'content_deliverables'}, debounceReload)
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
    sb.from('user_profiles').select('*').order('email'),
    sb.from('user_company_access').select('*').order('created_at', {ascending:false}),
    sb.from('content_asset_links').select('*').order('created_at', {ascending:false}),
    sb.from('content_comments').select('*').order('created_at', {ascending:true}),
    sb.from('content_deliverables').select('*').order('created_at', {ascending:false})
  ];
  if(hasRiberaAccess() || isRiberaUser()) promises.push(sb.from('prospects').select('*').order('updated_at', {ascending:false}));
  const [companies, items, assets, profiles, access, assetLinks, comments, deliverables, prospects] = await Promise.all(promises);
  if(companies.error) throwError(companies.error);
  if(items.error) throwError(items.error);
  if(assets.error) throwError(assets.error);
  if(profiles.error) throwError(new Error('Falta ejecutar migration_roles_rls.sql o no hay permisos para user_profiles.'));
  if(access.error) throwError(new Error('Falta ejecutar migration_roles_rls.sql o no hay permisos para user_company_access.'));
  if(assetLinks.error) throwError(new Error('Falta ejecutar migration_final_cliente_plan.sql o no hay permisos para content_asset_links.'));
  if(comments.error) throwError(new Error('Falta ejecutar migration_final_cliente_plan.sql o no hay permisos para content_comments.'));
  if(deliverables.error) throwError(new Error('Falta ejecutar migration_final_cliente_plan.sql o no hay permisos para content_deliverables.'));
  if(prospects?.error) throwError(prospects.error);
  state.companies = companies.data || [];
  state.items = items.data || [];
  state.assets = assets.data || [];
  state.profiles = profiles.data || [];
  state.access = access.data || [];
  state.assetLinks = assetLinks.data || [];
  state.comments = comments.data || [];
  state.deliverables = deliverables.data || [];
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
          <div class="brand-row brand-row-ribera"><div class="brand-mark brand-mark-ribera"><img src="${RIBERA_LOGO_PATH}" alt="Ribera Content Hub" class="brand-mark-image" /></div><div><div class="brand-title brand-title-ribera">Ribera Content Hub</div><div class="brand-subtitle">Supabase operativo</div></div></div>
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
  appBooted = true;
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
    inProcess: items.filter(i=>['produccion','revision'].includes(i.status)).length,
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
    ${stat('En proceso', m.inProcess, 'fa-gears', 'bg-blue', 'producción + revisión')}
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
        <span>${labelList(itemChannels(i),'Sin canal')}</span>
        <span>Resp: ${esc(i.owner || 'Sin responsable')}</span>
        <span>Deadline: ${fmtDate(i.internal_deadline)}</span>
      </div>
      ${i.next_action ? `<div class="item-desc"><strong>Próxima acción:</strong> ${esc(i.next_action)}</div>` : ''}
    </div>
    <div class="item-actions"><button class="btn ghost sm" onclick="openContentModal('${i.id}')">Editar</button></div>
  </div>`;
}
function renderItemCompact(i){
  return `<div class="item">
    <div class="item-main">
      <div class="item-title">${esc(i.title)}</div>
      <div class="item-meta"><span class="pill ${statusPill(i.status)}">${statusLabel(i.status)}</span><span>${fmtDate(i.internal_deadline)}</span><span>${labelList(itemChannels(i),'Sin canal')}</span></div>
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
      ${dayItems.length ? dayItems.map(i=>`<div class="week-task ${isOverdue(i)?'overdue':''}" onclick="openContentModal('${i.id}')">${esc(i.title)}<br><span style="color:var(--muted)">${esc(i.next_action||'Sin próxima acción')}</span></div>`).join('') : '<div class="item-desc">Sin tareas</div>'}
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
  const ym = `${currentYear}-${pfx}`;
  const firstDay = new Date(currentYear,currentMonth,1).getDay();
  const dim = new Date(currentYear,currentMonth+1,0).getDate();
  const prevMax = new Date(currentYear,currentMonth,0).getDate();
  let cells = DAYS.map(d=>`<div class="cal-head">${d}</div>`).join('');
  for(let i=firstDay-1;i>=0;i--) cells += `<div class="cal-day other"><div class="cal-num">${prevMax-i}</div></div>`;
  for(let d=1; d<=dim; d++){
    const iso = `${currentYear}-${pfx}-${String(d).padStart(2,'0')}`;
    const publishItems = items.filter(i=>isPublishedOnDate(i, iso)).sort((a,b)=>String(a.status).localeCompare(String(b.status)) || String(a.title).localeCompare(String(b.title)));
    const deadlineItems = items.filter(i=>i.internal_deadline===iso && !isPublishedOnDate(i, iso));
    const phaseItems = items.filter(i=>isOnRange(iso,i.idea_start_date,i.idea_end_date) || isOnRange(iso,i.production_start_date,i.production_end_date) || isOnRange(iso,i.review_start_date,i.review_end_date));
    const isToday = iso === todayISO();
    const canCreate = canEditCompanyData(currentCompanyId);
    cells += `<div class="cal-day ${isToday?'today':''} ${canCreate?'can-create':''}" onclick="${canCreate?`openContentModal(null,null,'${iso}')`:''}" title="${canCreate?`Agregar contenido para ${fmtDate(iso)}`:'Solo lectura'}">
      <div class="cal-day-top"><div class="cal-num">${d}</div>${canCreate?`<button class="cal-add-btn" onclick="event.stopPropagation();openContentModal(null,null,'${iso}')">+</button>`:''}</div>
      ${phaseItems.map(i=>renderPhasePill(i, iso)).join('')}
      ${publishItems.map(i=>renderCalendarPill(i, iso, 'publish')).join('')}
      ${deadlineItems.map(i=>renderCalendarPill(i, iso, 'deadline')).join('')}
    </div>`;
  }
  const rem = (firstDay + dim) % 7;
  for(let i=1;i<=(rem?7-rem:0);i++) cells += `<div class="cal-day other"><div class="cal-num">${i}</div></div>`;
  return `${renderStats()}
    <div class="panel">
      <div class="panel-head">
        <div>
          <div class="panel-title">Calendario operativo</div>
          <div class="item-desc">Tocá cualquier día para crear una pieza. Las fases, deadlines y fijaciones se ven por separado para que el cliente entienda el plan.</div>
        </div>
        <div class="panel-actions"><button class="btn ghost sm" onclick="changeMonth(-1)">← Mes anterior</button><strong>${MONTHS[currentMonth]} ${currentYear}</strong><button class="btn ghost sm" onclick="changeMonth(1)">Mes siguiente →</button></div>
      </div>
      <div class="calendar-legend">
        <span class="legend-dot phase-idea"></span> Tiempo de idea
        <span class="legend-dot phase-prod"></span> Producción
        <span class="legend-dot phase-review"></span> Edición / revisión
        <span class="legend-dot status-publicado"></span> Publicado / fijado
        <span class="legend-dot deadline"></span> Deadline interno
      </div>
      <div class="calendar-wrap"><div class="calendar-grid">${cells}</div></div>
    </div>
    ${renderCalendarList(items, ym)}`;
}
function renderCalendarList(items, ym){
  const status = window.__calendarStatus || '';
  const type = window.__calendarType || '';
  const list = items.filter(i=>itemInMonth(i, ym))
    .filter(i=>!status || i.status===status)
    .filter(i=>!type || itemTypes(i).includes(type))
    .sort((a,b)=>String(itemPrimaryDate(a)).localeCompare(String(itemPrimaryDate(b))));
  return `<div class="panel client-list-panel">
    <div class="panel-head"><div><div class="panel-title">Lista del mes</div><div class="item-desc">Vista tipo plan para cliente: fecha, plataforma, tipo, estado y comentarios.</div></div></div>
    <div class="filters client-filters">
      <select class="form-input" onchange="window.__calendarStatus=this.value;render()"><option value="">Todos los estados</option>${STATUS.map(s=>`<option value="${s.key}" ${s.key===status?'selected':''}>${s.label}</option>`).join('')}</select>
      <select class="form-input" onchange="window.__calendarType=this.value;render()"><option value="">Todos los tipos</option>${CONTENT_TYPES.map(t=>`<option ${t===type?'selected':''}>${t}</option>`).join('')}</select>
    </div>
    <div class="content-table-wrap"><table class="content-table"><thead><tr><th>Fecha</th><th>Hora</th><th>Título</th><th>Plataforma</th><th>Tipo</th><th>Estado</th><th>Cmt</th><th></th></tr></thead><tbody>
      ${list.map(i=>`<tr>
        <td>${fmtDate(itemPrimaryDate(i))}</td>
        <td>${esc(i.publish_time || '-')}</td>
        <td><strong>${esc(i.title)}</strong></td>
        <td>${labelList(itemChannels(i))}</td>
        <td>${labelList(itemTypes(i))}</td>
        <td><span class="pill ${statusPill(i.status)}">${statusLabel(i.status)}</span></td>
        <td>${contentComments(i.id).length ? `<span class="comment-count">${contentComments(i.id).length}</span>` : '-'}</td>
        <td><button class="icon-btn" onclick="openContentModal('${i.id}')"><i class="fa-regular fa-eye"></i></button></td>
      </tr>`).join('') || `<tr><td colspan="8" class="table-empty">Sin contenidos para este filtro.</td></tr>`}
    </tbody></table></div>
  </div>`;
}

window.changeMonth = (delta)=>{ currentMonth += delta; if(currentMonth<0){currentMonth=11;currentYear--;} if(currentMonth>11){currentMonth=0;currentYear++;} render(); };

function renderKanban(){
  const ym = window.__kanbanMonth || `${currentYear}-${String(currentMonth+1).padStart(2,'0')}`;
  const type = window.__kanbanType || '';
  const items = filteredItems().filter(i=>itemInMonth(i, ym)).filter(i=>!type || itemTypes(i).includes(type));
  return `<div class="panel"><div class="panel-head"><div><div class="panel-title">Tablero Kanban</div><div class="item-desc">Segmentado por mes y tipo para ver carga real de producción.</div></div><button class="btn primary sm" onclick="openContentModal()"><i class="fa-solid fa-plus"></i> Nuevo</button></div>
  <div class="filters client-filters">
    <input class="form-input" type="month" value="${escAttr(ym)}" onchange="window.__kanbanMonth=this.value;render()" />
    <select class="form-input" onchange="window.__kanbanType=this.value;render()"><option value="">Todos los tipos</option>${CONTENT_TYPES.map(t=>`<option ${t===type?'selected':''}>${t}</option>`).join('')}</select>
  </div>
  <div class="kanban">${STATUS.map(s=>{
    const cards = items.filter(i=>i.status===s.key);
    return `<div class="kanban-col"><div class="kanban-head"><div class="kanban-title">${s.label}</div><div class="kanban-count">${cards.length}</div></div>
      ${cards.map(renderKanbanCard).join('') || '<div class="empty">Sin piezas</div>'}
      <button class="btn ghost sm full" onclick="openContentModal(null,'${s.key}')"><i class="fa-solid fa-plus"></i> Agregar</button>
    </div>`;
  }).join('')}</div></div>`;
}
function renderKanbanCard(i){
  return `<div class="kanban-card" onclick="openContentModal('${i.id}')">
    <div class="card-row"><span class="pill ${statusPill(i.status)}">${labelList(itemChannels(i),'Canal')}</span>${isOverdue(i)?'<span class="pill red">Atrasado</span>':''}</div>
    <div class="card-title">${esc(i.title)}</div>
    <div class="item-meta"><span>${fmtDate(i.internal_deadline)}</span><span>${esc(i.owner || 'Sin responsable')}</span></div>
    <div class="item-meta"><span>${labelList(itemTypes(i),'Sin tipo')}</span></div>
    ${i.next_action ? `<div class="item-desc">${esc(i.next_action)}</div>` : ''}
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
    next_action:'Validar idea', owner:'Compartido', created_by: session.user.id, updated_by: session.user.id
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
  const canManage = canManageCompanies();
  return `<div class="config-build-note">Build activo: ${esc(APP_BUILD)} · Usuario: ${esc(session?.user?.email || '')} · Admin: ${isAdminUser() ? 'sí' : 'no'}</div><div class="config-grid">
    <div class="panel"><div class="panel-head"><div><div class="panel-title">Empresas / clientes</div><div class="item-desc">${canManage ? 'Agregar, editar o eliminar empresas. Si borrás una con datos, se reasignan antes.' : 'Solo podés ver tus empresas asignadas. Pedile acceso a un admin si necesitás cambios.'}</div></div>${canManage ? '<button class="btn primary sm" onclick="openCompanyModal()"><i class="fa-solid fa-plus"></i> Agregar</button>' : ''}</div>
      ${visibleCompanies().map(c=>renderCompanyRow(c)).join('') || '<div class="empty">Sin empresas visibles</div>'}
    </div>
    <div class="panel"><div class="panel-head"><div class="panel-title">Backups</div></div>
      <p class="item-desc">Supabase centraliza los datos. El backup JSON queda como seguro adicional o migración rápida.</p>
      <div class="item-actions" style="margin-top:14px"><button class="btn ghost" onclick="exportBackup()"><i class="fa-solid fa-download"></i> Exportar backup</button><label class="btn ghost"><i class="fa-solid fa-upload"></i> Importar backup <input type="file" accept="application/json" style="display:none" onchange="importBackup(event)"></label></div>
    </div>
    ${isAdminUser() ? renderUsersAccessPanel() : renderMyAccessPanel()}
  </div>`;
}

function renderCompanyRow(c){
  const itemCount = state.items.filter(i=>i.company_id===c.id).length;
  const assetCount = state.assets.filter(a=>a.company_id===c.id).length;
  const role = companyRole(c.id) || 'sin acceso';
  const canEdit = canManageCompanies() || canAdminCompany(c.id);
  const canDelete = canManageCompanies() && !isRiberaCompany(c);
  return `<div class="company-row">
    <div class="company-row-main"><div class="mini-logo">${logoHTML(c)}</div><div class="item-main"><div class="company-name">${esc(c.name)}</div><div class="company-sub">${itemCount} contenidos · ${assetCount} assets · rol: ${esc(role)}</div></div></div>
    <div class="item-actions">${canEdit ? `<button class="btn ghost sm" onclick="openCompanyModal('${c.id}')">Editar</button>` : ''}${isRiberaCompany(c)?'<button class="btn ghost sm" disabled>Cuenta interna</button>':(canDelete?`<button class="btn danger sm" onclick="deleteCompany('${c.id}')">Eliminar</button>`:'')}</div>
  </div>`;
}

function renderMyAccessPanel(){
  const p = currentProfile();
  const rows = visibleCompanies().map(c=>`<div class="item"><div class="item-main"><div class="item-title">${esc(c.name)}</div><div class="item-meta"><span>Rol: ${esc(companyRole(c.id)||'sin acceso')}</span></div></div></div>`).join('');
  return `<div class="panel"><div class="panel-head"><div><div class="panel-title">Mi acceso</div><div class="item-desc">Tu perfil define qué empresas ves y qué acciones podés ejecutar.</div></div></div>
    <div class="item"><div class="item-main"><div class="item-title">${esc(p?.email || session?.user?.email || 'Usuario')}</div><div class="item-meta"><span>${esc(p?.role || 'sin perfil')}</span><span>${p?.can_delete?'puede borrar':'sin permiso de borrado'}</span><span>${p?.can_manage_companies?'administra empresas':'no administra empresas'}</span></div></div></div>
    ${rows || '<div class="empty">Sin empresas asignadas</div>'}
  </div>`;
}

function renderUsersAccessPanel(){
  return `<div class="panel span-2"><div class="panel-head"><div><div class="panel-title">Usuarios y permisos</div><div class="item-desc">Administrá roles, capacidad de borrado y acceso por empresa. Los usuarios deben existir primero en Supabase Auth.</div></div></div>
    <div class="list">${state.profiles.map(p=>renderUserRow(p)).join('') || '<div class="empty">Sin usuarios</div>'}</div>
  </div>`;
}
function renderUserRow(p){
  const accesses = state.access.filter(a=>a.user_id===p.user_id);
  const companies = accesses.map(a=>`${esc(state.companies.find(c=>c.id===a.company_id)?.name || 'Empresa')} (${esc(a.role)})`).join(' · ') || 'Sin empresas asignadas';
  const flags = [p.active ? 'activo' : 'inactivo', p.can_manage_companies ? 'administra empresas' : 'no administra empresas', p.can_delete ? 'puede borrar' : 'sin borrado', p.ribera_access ? 'nivel Ribera' : 'sin Ribera'].join(' · ');
  return `<div class="item"><div class="item-main"><div class="item-title">${esc(p.email)}</div><div class="item-meta"><span>${esc(p.role)}</span><span>${flags}</span></div><div class="item-desc">${companies}</div></div><div class="item-actions"><button class="btn ghost sm" onclick="openUserModal('${p.user_id}')">Permisos</button></div></div>`;
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
function openContentModal(id=null, status=null, presetDate=null){
  const item = id ? state.items.find(i=>i.id===id) : null;
  const canEdit = canEditCompanyData(item?.company_id || currentCompanyId);
  const selectedChannels = itemChannels(item);
  const selectedTypes = itemTypes(item);
  const productionElements = listArray(item, 'production_elements');
  const plannedDeliverables = listArray(item, 'planned_deliverables');
  const isNewContent = !item;
  const initialStatus = item?.status || status || 'idea';
  const autoIdeaDate = item?.idea_start_date || (isNewContent && presetDate && initialStatus === 'idea' ? presetDate : '');
  const autoProdStart = item?.production_start_date || (isNewContent && presetDate && initialStatus === 'produccion' ? presetDate : '');
  const autoProdEnd = item?.production_end_date || autoProdStart;
  const autoReviewStart = item?.review_start_date || (isNewContent && presetDate && initialStatus === 'revision' ? presetDate : '');
  const autoReviewEnd = item?.review_end_date || autoReviewStart;
  const autoPublishDate = item?.publish_date || (isNewContent && presetDate && initialStatus === 'publicado' ? presetDate : '');
  const clientFicha = item ? `<div class="content-client-view content-client-view-bottom"><div class="client-bottom-title">Vista cliente, entregables y conversación</div>${renderContentFlow(item)}${renderApprovalMini(item)}${renderDeliverablesPanel(item)}${renderAssociatedAssetsPanel(item)}${renderCommentsPanel(item)}</div>` : '';
  const body = `<form id="content-form" data-is-new="${isNewContent?'1':'0'}" data-preset-date="${escAttr(presetDate||'')}">
    <div class="form-grid">
      <div class="form-group"><label class="form-label">Empresa</label><select class="form-input" name="company_id">${companyOptions(item?.company_id || currentCompanyId)}</select></div>
      <div class="form-group"><label class="form-label">Estado</label><select class="form-input" name="status" onchange="syncPhaseDatesByStatus(this)">${STATUS.map(s=>`<option value="${s.key}" ${s.key===initialStatus?'selected':''}>${s.label}</option>`).join('')}</select></div>
      <div class="form-group span-2"><label class="form-label">Título</label><input class="form-input" name="title" required value="${escAttr(item?.title||'')}" placeholder="Ej: Reel educativo sobre..." /></div>
      <div class="form-group span-2"><label class="form-label">Descripción / concepto</label><textarea class="form-input" name="description" placeholder="Gancho, enfoque, CTA...">${esc(item?.description||'')}</textarea></div>
      <div class="form-group"><label class="form-label">Responsable</label><select class="form-input" name="owner"><option ${!item?.owner?'selected':''}></option>${['Persona 1','Persona 2','Compartido'].map(x=>`<option ${x===item?.owner?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Próxima acción</label><select class="form-input" name="next_action"><option></option>${NEXT_ACTIONS.map(x=>`<option ${x===item?.next_action?'selected':''}>${x}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Deadline interno</label><input class="form-input" type="date" name="internal_deadline" value="${escAttr(item?.internal_deadline||'')}" /></div>
      <div class="form-group"><label class="form-label">Prioridad</label><select class="form-input" name="priority">${['alta','media','baja'].map(x=>`<option ${x===(item?.priority||'media')?'selected':''}>${x}</option>`).join('')}</select></div>

      <div class="form-group span-2"><label class="form-label">Canales</label>${checkboxGrid('channels', CHANNELS, selectedChannels)}</div>
      <div class="form-group span-2"><label class="form-label">Tipos de contenido</label>${checkboxGrid('content_types', CONTENT_TYPES, selectedTypes)}</div>

      <div class="form-group span-2"><label class="form-label">Plan de fechas</label>
        <div class="date-plan-grid">
          <div class="date-plan-card single-date"><div><strong>Idea</strong><small>Fecha en la que se define o presenta la idea.</small></div><input class="form-input" type="date" name="idea_start_date" value="${escAttr(autoIdeaDate)}" /></div>
          <div class="date-plan-card range-date"><div><strong>Producción</strong><small>Rango real de grabación / armado.</small></div><input class="form-input" type="date" name="production_start_date" value="${escAttr(autoProdStart)}" /><span>→</span><input class="form-input" type="date" name="production_end_date" value="${escAttr(autoProdEnd)}" /></div>
          <div class="date-plan-card range-date"><div><strong>Edición / revisión</strong><small>Rango de edición, ajustes y revisión.</small></div><input class="form-input" type="date" name="review_start_date" value="${escAttr(autoReviewStart)}" /><span>→</span><input class="form-input" type="date" name="review_end_date" value="${escAttr(autoReviewEnd)}" /></div>
          <div class="date-plan-card single-date"><div><strong>Publicación</strong><small>Fecha final publicada o programada.</small></div><input class="form-input" type="date" name="publish_date" value="${escAttr(autoPublishDate)}" /></div>
        </div>
      </div>

      <div class="form-group"><label class="form-label">Etapa idea</label><select class="form-input" name="idea_stage"><option></option>${IDEA_STAGES.map(x=>`<option value="${x.key}" ${x.key===(item?.idea_stage||'cruda')?'selected':''}>${x.label}</option>`).join('')}</select></div>
      <div class="form-group"><label class="form-label">Link final / Drive</label><input class="form-input" name="link_url" type="url" value="${escAttr(item?.link_url||'')}" placeholder="https://..." /></div>

      <div class="form-group span-2"><label class="form-label">Qué se va a usar</label><textarea class="form-input" name="resources_to_use" placeholder="Locación, referencias, tomas necesarias, assets, textos, música...">${esc(item?.resources_to_use||'')}</textarea></div>
      <div class="form-group span-2"><label class="form-label">Elementos de producción</label><div class="item-desc form-helper">Recursos o insumos a preparar/coordinar: cámara, luces, micrófonos, drone, locación, props, actores, productos, uniforme, etc.</div>${renderListEditor('production-elements-editor', productionElements, 'Ej: Cámara principal, luces, drone, locación...', 'Agregar elemento')}</div>
      <div class="form-group span-2"><label class="form-label">Entregables previstos</label><div class="item-desc form-helper">Piezas finales prometidas o esperadas: reel, historia, portada, copy, subtítulos, adaptación vertical, carrusel, etc.</div>${renderListEditor('planned-deliverables-editor', plannedDeliverables, 'Ej: Reel 30s, historia, portada, copy...', 'Agregar entregable')}</div>
      <div class="form-group span-2"><label class="form-label">Assets de biblioteca asociados</label>${renderAssetPicker(item)}</div>
      <div class="form-group span-2"><label class="form-label">Tags</label><input class="form-input" name="tags" value="${escAttr(item?.tags||'')}" placeholder="limpieza, institucional, campaña" /></div>
      <div class="form-group span-2"><label class="form-label">Desarrollo</label><textarea class="form-input" name="development" placeholder="Estructura, guión, visuales, notas de edición...">${esc(item?.development||'')}</textarea></div>
    </div>
  </form>${clientFicha}`;
  const canDeleteItem = item && canDeleteRecords() && canEditCompanyData(item.company_id);
  const footer = `<button class="btn danger" ${canDeleteItem?'':'style="visibility:hidden"'} onclick="deleteContent('${item?.id||''}')"><i class="fa-solid fa-trash"></i> Eliminar</button><div class="modal-footer-right"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" ${canEdit?'':'disabled'} onclick="saveContent('${item?.id||''}')"><i class="fa-solid fa-check"></i> Guardar</button></div>`;
  openModal(modalShell(item?'Ficha de contenido':'Nuevo contenido', body, footer));
}

window.syncPhaseDatesByStatus = (select)=>{
  const form = document.getElementById('content-form');
  if(!form || form.dataset.isNew !== '1') return;
  const preset = form.dataset.presetDate || '';
  if(!preset) return;
  const fields = ['idea_start_date','production_start_date','production_end_date','review_start_date','review_end_date','publish_date'];
  fields.forEach(name=>{
    const el = form.elements[name];
    if(el) el.value = '';
  });
  const status = select.value;
  if(status === 'idea'){
    if(form.elements.idea_start_date) form.elements.idea_start_date.value = preset;
  } else if(status === 'produccion'){
    if(form.elements.production_start_date) form.elements.production_start_date.value = preset;
    if(form.elements.production_end_date) form.elements.production_end_date.value = preset;
  } else if(status === 'revision'){
    if(form.elements.review_start_date) form.elements.review_start_date.value = preset;
    if(form.elements.review_end_date) form.elements.review_end_date.value = preset;
  } else if(status === 'publicado'){
    if(form.elements.publish_date) form.elements.publish_date.value = preset;
  }
};
window.openContentModal = openContentModal;
window.addStructuredListRow = (editorId, placeholder='Agregar ítem')=>{
  const box = document.getElementById(editorId);
  const btn = box?.querySelector('.list-add-btn');
  if(!box || !btn) return;
  btn.insertAdjacentHTML('beforebegin', renderListRow({}, placeholder));
};
window.removeStructuredListRow = (btn)=>{
  const row = btn?.closest('.structured-list-row');
  if(row) row.remove();
};
function readStructuredList(editorId){
  return Array.from(document.querySelectorAll(`#${editorId} .structured-list-row`)).map(row=>({
    done: !!row.querySelector('.structured-list-done')?.checked,
    text: row.querySelector('.structured-list-text')?.value.trim() || ''
  })).filter(x=>x.text);
}
window.saveContent = async(id='')=>{
  const form = new FormData($('#content-form'));
  const payload = Object.fromEntries(form.entries());
  payload.channels = form.getAll('channels');
  payload.content_types = form.getAll('content_types');
  payload.channel = payload.channels[0] || null;
  payload.content_type = payload.content_types[0] || null;
  payload.tags = parseTags(payload.tags);
  payload.production_elements = readStructuredList('production-elements-editor');
  payload.planned_deliverables = readStructuredList('planned-deliverables-editor');
  payload.checklist = payload.planned_deliverables;
  ['internal_deadline','publish_date','publish_end_date','idea_start_date','idea_end_date','production_start_date','production_end_date','review_start_date','review_end_date'].forEach(k=>{ if(!payload[k]) payload[k] = null; });
  // Idea y publicación son fechas únicas. Se guardan también como fin para mantener compatibilidad con calendario/rangos anteriores.
  if(payload.idea_start_date) payload.idea_end_date = payload.idea_start_date;
  if(payload.publish_date) payload.publish_end_date = payload.publish_date;
  for(const pair of [['production_start_date','production_end_date'],['review_start_date','review_end_date']]){
    const [s,e]=pair;
    if(payload[s] && payload[e] && payload[e] < payload[s]){ toast(`La fecha fin no puede ser anterior a la fecha inicio (${s}).`, 'error'); return; }
  }
  payload.approved = null;
  payload.updated_by = session.user.id;
  if(!id) payload.created_by = session.user.id;
  if(!payload.title?.trim()){ toast('El título es obligatorio', 'error'); return; }
  if(!visibleCompanies().some(c=>c.id===payload.company_id)){ toast('No tenés acceso a esa empresa.', 'error'); return; }
  if(!canEditCompanyData(payload.company_id)){ toast('No tenés permiso de edición para esa empresa.', 'error'); return; }
  let contentId = id;
  let error;
  if(id){
    ({ error } = await sb.from('content_items').update(payload).eq('id', id));
  } else {
    const res = await sb.from('content_items').insert(payload).select('id').single();
    error = res.error;
    contentId = res.data?.id;
  }
  if(error) return throwError(error);
  if(contentId) await saveContentAssetLinks(contentId);
  await loadAll(); closeModal(); render(); toast('Contenido guardado');
};
async function saveContentAssetLinks(contentId){
  const selected = new Set($$('input[name="asset_ids"]:checked').map(i=>i.value));
  await sb.from('content_asset_links').delete().eq('content_item_id', contentId);
  if(!selected.size) return;
  const rows = [...selected].map(asset_id=>({content_item_id:contentId, asset_id, role:'referencia', created_by:session.user.id}));
  const { error } = await sb.from('content_asset_links').insert(rows);
  if(error) throwError(error);
}
window.addContentComment = async(contentId)=>{
  const body = $('#new-comment-body')?.value.trim();
  if(!body) return;
  const item = state.items.find(i=>i.id===contentId);
  if(!item || !canEditCompanyData(item.company_id)){ toast('No tenés permiso para comentar.', 'error'); return; }
  const { error } = await sb.from('content_comments').insert({content_item_id:contentId, body, created_by:session.user.id});
  if(error) return throwError(error);
  await loadAll(); openContentModal(contentId); toast('Comentario agregado');
};
window.addDeliverable = async(contentId)=>{
  const title = $('#new-deliverable-title')?.value.trim() || 'Entregable';
  const link = $('#new-deliverable-url')?.value.trim();
  const status = $('#new-deliverable-status')?.value || 'En revisión';
  if(!link){ toast('Cargá un link de entregable.', 'error'); return; }
  const item = state.items.find(i=>i.id===contentId);
  if(!item || !canEditCompanyData(item.company_id)){ toast('No tenés permiso para agregar entregables.', 'error'); return; }
  const version = contentDeliverables(contentId).length + 1;
  const { error } = await sb.from('content_deliverables').insert({content_item_id:contentId,title,link_url:link,status,version_label:`v${version}`,created_by:session.user.id});
  if(error) return throwError(error);
  await loadAll(); openContentModal(contentId); toast('Entregable agregado');
};

window.approveIdeaAndMove = async(id)=>{
  const item = state.items.find(i=>i.id===id);
  if(!item || !canEditCompanyData(item.company_id)){ toast('No tenés permiso para aprobar esta idea.', 'error'); return; }
  const payload = {
    status:'produccion',
    idea_stage:'validada',
    production_start_date: item.production_start_date || todayISO(),
    updated_by: session.user.id
  };
  const { error } = await sb.from('content_items').update(payload).eq('id', id);
  if(error) return throwError(error);
  await sb.from('content_comments').insert({content_item_id:id, body:'Idea aprobada por cliente. Se pasa a producción.', created_by:session.user.id});
  await loadAll(); openContentModal(id); toast('Idea aprobada y movida a producción');
};
window.moveContentToReview = async(id)=>{
  const item = state.items.find(i=>i.id===id);
  if(!item || !canEditCompanyData(item.company_id)){ toast('No tenés permiso para mover este contenido.', 'error'); return; }
  const payload = {
    status:'revision',
    review_start_date: item.review_start_date || todayISO(),
    updated_by: session.user.id
  };
  const { error } = await sb.from('content_items').update(payload).eq('id', id);
  if(error) return throwError(error);
  await sb.from('content_comments').insert({content_item_id:id, body:'Contenido pasado a edición / revisión.', created_by:session.user.id});
  await loadAll(); openContentModal(id); toast('Contenido en edición / revisión');
};
window.clientApprovePiece = async(id)=>{
  const item = state.items.find(i=>i.id===id);
  if(!item || !canEditCompanyData(item.company_id)){ toast('No tenés permiso para registrar aprobación.', 'error'); return; }
  const payload = {
    client_piece_approved_at: new Date().toISOString(),
    client_piece_approved_by: session.user.id,
    updated_by: session.user.id
  };
  const { error } = await sb.from('content_items').update(payload).eq('id', id);
  if(error) return throwError(error);
  await sb.from('content_comments').insert({content_item_id:id, body:'Cliente aprobó la pieza. Queda lista para publicación por Ribera.', created_by:session.user.id});
  await loadAll(); openContentModal(id); toast('Cliente aprobó la pieza. Falta publicar por Ribera.');
};
window.publishApprovedContent = async(id)=>{
  const item = state.items.find(i=>i.id===id);
  if(!item || !canEditCompanyData(item.company_id)){ toast('No tenés permiso para publicar este contenido.', 'error'); return; }
  if(!(item.client_piece_approved_at || item.client_approved_at || item.piece_approved_at)){
    toast('Primero registrá la aprobación del cliente.', 'error');
    return;
  }
  const payload = {
    status:'publicado',
    publish_date: item.publish_date || todayISO(),
    publish_end_date: item.publish_end_date || item.publish_date || todayISO(),
    updated_by: session.user.id
  };
  const { error } = await sb.from('content_items').update(payload).eq('id', id);
  if(error) return throwError(error);
  await sb.from('content_comments').insert({content_item_id:id, body:'Ribera marcó el contenido como publicado.', created_by:session.user.id});
  await loadAll(); openContentModal(id); toast('Contenido publicado por Ribera');
};
window.deleteDeliverable = async(id)=>{
  const deliverable = state.deliverables.find(d=>d.id===id);
  const contentId = deliverable?.content_item_id;
  if(!id || !confirm('¿Eliminar este entregable?')) return;
  const { error } = await sb.from('content_deliverables').delete().eq('id', id);
  if(error) return throwError(error);
  await loadAll();
  if(contentId) openContentModal(contentId);
  else render();
  toast('Entregable eliminado');
};

window.deleteContent = async(id)=>{
  if(!id || !confirm('¿Eliminar este contenido?')) return;
  const item = state.items.find(x=>x.id===id);
  if(!item || !canDeleteRecords() || !canEditCompanyData(item.company_id)){ toast('No tenés permiso para borrar este contenido.', 'error'); return; }
  const { error } = await sb.from('content_items').delete().eq('id', id);
  if(error) return throwError(error);
  await loadAll(); closeModal(); render(); toast('Contenido eliminado');
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
  const canDeleteAsset = a && canDeleteRecords() && canEditCompanyData(a.company_id);
  const footer = `<button class="btn danger" ${canDeleteAsset?'':'style="visibility:hidden"'} onclick="deleteAsset('${a?.id||''}')"><i class="fa-solid fa-trash"></i> Eliminar</button><div class="modal-footer-right"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveAsset('${a?.id||''}')">Guardar</button></div>`;
  openModal(modalShell(a?'Editar asset':'Nuevo asset', body, footer));
}
window.openAssetModal = openAssetModal;
window.saveAsset = async(id='')=>{
  const payload = Object.fromEntries(new FormData($('#asset-form')).entries());
  payload.tags = parseTags(payload.tags);
  if(!payload.name?.trim()){ toast('El nombre es obligatorio', 'error'); return; }
  if(!visibleCompanies().some(c=>c.id===payload.company_id)){ toast('No tenés acceso a esa empresa.', 'error'); return; }
  if(!canEditCompanyData(payload.company_id)){ toast('No tenés permiso de edición para esa empresa.', 'error'); return; }
  const query = id ? sb.from('assets').update(payload).eq('id', id) : sb.from('assets').insert(payload);
  const { error } = await query;
  if(error) return throwError(error);
  await loadAll(); closeModal(); render(); toast('Asset guardado');
};
window.deleteAsset = async(id)=>{
  if(!id || !confirm('¿Eliminar este asset?')) return;
  const asset = state.assets.find(x=>x.id===id);
  if(!asset || !canDeleteRecords() || !canEditCompanyData(asset.company_id)){ toast('No tenés permiso para borrar este asset.', 'error'); return; }
  const { error } = await sb.from('assets').delete().eq('id', id);
  if(error) return throwError(error);
  await loadAll(); closeModal(); render(); toast('Asset eliminado');
};

function openCompanyModal(id=null){
  const c = id ? state.companies.find(x=>x.id===id) : null;
  if(!canManageCompanies() && !(c && canAdminCompany(c.id))){ toast('No tenés permiso para administrar empresas.', 'error'); return; }
  const body = `<form id="company-form"><div class="form-grid">
    <div class="form-group span-2"><label class="form-label">Nombre</label><input class="form-input" name="name" required value="${escAttr(c?.name||'')}" /></div>
    <div class="form-group"><label class="form-label">Color</label><input class="form-input" name="color" type="color" value="${escAttr(c?.color || colorForName(c?.name || 'Nueva empresa'))}" /></div>
    <div class="form-group"><label class="form-label">Logo URL</label><input class="form-input" name="logo_url" type="url" value="${escAttr(c?.logo_url||'')}" placeholder="https://..." /></div>
  </div></form>`;
  const footer = `<button class="btn danger" ${(c && canManageCompanies() && !isRiberaCompany(c))?'':'style="visibility:hidden"'} onclick="deleteCompany('${c?.id||''}')"><i class="fa-solid fa-trash"></i> Eliminar</button><div class="modal-footer-right"><button class="btn ghost" onclick="closeModal()">Cancelar</button><button class="btn primary" onclick="saveCompany('${c?.id||''}')">Guardar</button></div>`;
  openModal(modalShell(c?'Editar empresa':'Nueva empresa', body, footer));
}
window.openCompanyModal = openCompanyModal;
window.saveCompany = async(id='')=>{
  const payload = Object.fromEntries(new FormData($('#company-form')).entries());
  if(!id && !canManageCompanies()){ toast('No tenés permiso para crear empresas.', 'error'); return; }
  if(id && !canManageCompanies() && !canAdminCompany(id)){ toast('No tenés permiso para editar esta empresa.', 'error'); return; }
  if(!payload.name?.trim()){ toast('El nombre es obligatorio', 'error'); return; }
  if(normalize(payload.name)===normalize(RIBERA_COMPANY_NAME) && !isRiberaUser()){ toast('Ribera Audiovisual solo puede administrarse desde el usuario autorizado.', 'error'); return; }
  const query = id ? sb.from('companies').update(payload).eq('id', id) : sb.from('companies').insert(payload);
  const { error } = await query;
  if(error) return throwError(error);
  await loadAll(); closeModal(); render(); toast('Empresa guardada');
};
window.deleteCompany = async(id)=>{
  if(!id) return;
  if(!canManageCompanies()){ toast('No tenés permiso para eliminar empresas.', 'error'); return; }
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


function openUserModal(userId){
  if(!isAdminUser()){ toast('Solo un admin puede gestionar usuarios.', 'error'); return; }
  const p = state.profiles.find(x=>x.user_id===userId);
  if(!p){ toast('Usuario no encontrado.', 'error'); return; }
  const accessByCompany = new Map(state.access.filter(a=>a.user_id===userId).map(a=>[a.company_id, a.role]));
  const companyRows = state.companies.map(c=>{
    const role = accessByCompany.get(c.id) || '';
    return `<div class="company-row"><div class="company-row-main"><div class="mini-logo">${logoHTML(c)}</div><div><div class="company-name">${esc(c.name)}</div><div class="company-sub">Acceso por empresa</div></div></div><select class="form-input access-role" data-company-id="${c.id}" style="max-width:170px"><option value="">Sin acceso</option><option value="viewer" ${role==='viewer'?'selected':''}>Solo lectura</option><option value="editor" ${role==='editor'?'selected':''}>Editor</option><option value="admin" ${role==='admin'?'selected':''}>Admin empresa</option></select></div>`;
  }).join('');
  const body = `<form id="user-form">
    <div class="form-grid">
      <div class="form-group span-2"><label class="form-label">Email</label><input class="form-input" value="${escAttr(p.email)}" disabled /></div>
      <div class="form-group"><label class="form-label">Nombre</label><input class="form-input" name="full_name" value="${escAttr(p.full_name||'')}" /></div>
      <div class="form-group"><label class="form-label">Rol global</label><select class="form-input" name="role"><option value="viewer" ${p.role==='viewer'?'selected':''}>Solo lectura</option><option value="editor" ${p.role==='editor'?'selected':''}>Editor</option><option value="admin_ribera" ${p.role==='admin_ribera'?'selected':''}>Admin Ribera</option></select></div>
      <label class="form-group"><span class="form-label">Activo</span><select class="form-input" name="active"><option value="true" ${p.active?'selected':''}>Sí</option><option value="false" ${!p.active?'selected':''}>No</option></select></label>
      <label class="form-group"><span class="form-label">Puede borrar</span><select class="form-input" name="can_delete"><option value="false" ${!p.can_delete?'selected':''}>No</option><option value="true" ${p.can_delete?'selected':''}>Sí</option></select></label>
      <label class="form-group"><span class="form-label">Administra empresas</span><select class="form-input" name="can_manage_companies"><option value="false" ${!p.can_manage_companies?'selected':''}>No</option><option value="true" ${p.can_manage_companies?'selected':''}>Sí</option></select></label>
      <label class="form-group"><span class="form-label">Nivel Ribera</span><select class="form-input" name="ribera_access"><option value="false" ${!p.ribera_access?'selected':''}>No</option><option value="true" ${p.ribera_access?'selected':''}>Sí</option></select></label>
    </div>
    <div class="panel" style="margin-top:10px"><div class="panel-title" style="margin-bottom:10px">Acceso por empresa</div>${companyRows}</div>
  </form>`;
  const footer = `<button class="btn ghost" onclick="closeModal()">Cancelar</button><div class="modal-footer-right"><button class="btn primary" onclick="saveUserPermissions('${p.user_id}')">Guardar permisos</button></div>`;
  openModal(modalShell('Permisos de usuario', body, footer));
}
window.openUserModal = openUserModal;
window.saveUserPermissions = async(userId)=>{
  if(!isAdminUser()){ toast('Solo un admin puede guardar permisos.', 'error'); return; }
  const form = new FormData($('#user-form'));
  const payload = Object.fromEntries(form.entries());
  payload.active = payload.active === 'true';
  payload.can_delete = payload.can_delete === 'true';
  payload.can_manage_companies = payload.can_manage_companies === 'true';
  payload.ribera_access = payload.ribera_access === 'true';
  if(userId === session.user.id && payload.role !== 'admin_ribera'){
    toast('No te quites tu propio rol admin desde la app. Hacelo por SQL si realmente corresponde.', 'error');
    return;
  }
  const { error: profileError } = await sb.from('user_profiles').update(payload).eq('user_id', userId);
  if(profileError) return throwError(profileError);
  const { error: deleteError } = await sb.from('user_company_access').delete().eq('user_id', userId);
  if(deleteError) return throwError(deleteError);
  const accessRows = $$('.access-role').map(sel=>({ company_id: sel.dataset.companyId, role: sel.value })).filter(x=>x.role).map(x=>({ user_id: userId, company_id: x.company_id, role: x.role }));
  if(accessRows.length){
    const { error: insertError } = await sb.from('user_company_access').insert(accessRows);
    if(insertError) return throwError(insertError);
  }
  await loadAll(); closeModal(); render(); toast('Permisos actualizados');
};

window.exportBackup = ()=>{
  const data = JSON.stringify({ version:1, exported_at:new Date().toISOString(), companies:state.companies, content_items:state.items, assets:state.assets, prospects:state.prospects, user_profiles:state.profiles, user_company_access:state.access }, null, 2);
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
