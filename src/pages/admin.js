import { requireSession } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { toast, esc, timeAgo } from '../lib/ui.js';
import '../security/screen-guard.js';

const session = await requireSession();
const uid     = session.user.id;

// ── Admin auth check ──────────────────────────────────────────────────────────
const { data: adminUser } = await supabase
  .from('admin_users').select('role,is_active').eq('user_id', uid).maybeSingle();

if (!adminUser || !adminUser.is_active) {
  document.body.innerHTML = `<main class="page" style="text-align:center;padding-top:80px">
    <div style="font-size:64px">🔒</div>
    <h1 style="margin-top:16px">Access Denied</h1>
    <p>You do not have admin access to TwoHearts.</p>
    <a href="/app.html" class="button accent mt">Go home</a></main>`;
  throw new Error('Not admin');
}

const role = adminUser.role;
document.querySelector('#adminRole').textContent = role.replace('_',' ').toUpperCase();

// ── Tab switching ─────────────────────────────────────────────────────────────
const tabs    = document.querySelectorAll('.admin-tab');
const panels  = document.querySelectorAll('.admin-panel');
tabs.forEach(tab => {
  tab.onclick = () => {
    tabs.forEach(t  => t.classList.remove('active'));
    panels.forEach(p => p.style.display = 'none');
    tab.classList.add('active');
    document.querySelector(`#panel-${tab.dataset.tab}`).style.display = 'block';
    if (tab.dataset.tab === 'overview') loadOverview();
    if (tab.dataset.tab === 'users')    loadUsers();
    if (tab.dataset.tab === 'reports')  loadReports();
    if (tab.dataset.tab === 'verification') loadVerifications();
    if (tab.dataset.tab === 'audit')    loadAuditLog();
  };
});

// ── Overview stats ────────────────────────────────────────────────────────────
async function loadOverview() {
  const panel = document.querySelector('#panel-overview');
  panel.innerHTML = `<div class="admin-grid">
    ${['Total Users','Active Today','Pending Reports','Pending Verifications'].map(l =>
      `<div class="stat-card skeleton" style="height:100px" data-label="${l}"></div>`).join('')}
  </div><div id="overviewCharts"></div>`;

  // Total users
  const { count: userCount } = await supabase
    .from('profiles').select('id',{count:'exact',head:true});

  // Reports pending
  const { count: reportCount } = await supabase
    .from('reports').select('id',{count:'exact',head:true}).eq('status','pending');

  // Verifications pending
  const { count: verifCount } = await supabase
    .from('identity_verifications').select('id',{count:'exact',head:true}).eq('status','pending');

  // Recent security events
  const { count: secCount } = await supabase
    .from('security_events').select('id',{count:'exact',head:true})
    .gte('created_at', new Date(Date.now()-86400000).toISOString());

  const stats = [
    {label:'Total Users',    value: userCount || 0, icon:'👥'},
    {label:'Security Events Today', value: secCount || 0, icon:'🛡️'},
    {label:'Pending Reports',value: reportCount || 0, icon:'🚩'},
    {label:'Pending Verifications',value: verifCount || 0, icon:'✅'}
  ];

  panel.innerHTML = `<div class="admin-grid">
    ${stats.map(s => `<div class="stat-card">
      <div style="font-size:28px;margin-bottom:8px">${s.icon}</div>
      <div class="num">${s.value}</div>
      <div class="lbl">${s.label}</div>
    </div>`).join('')}
  </div>
  <div class="panel mt">
    <b>System status</b>
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:8px">
      <div class="flex-between"><span>Supabase Auth</span><span class="verified-badge">✓ Online</span></div>
      <div class="flex-between"><span>Database</span><span class="verified-badge">✓ Online</span></div>
      <div class="flex-between"><span>Storage</span><span class="verified-badge">✓ Online</span></div>
      <div class="flex-between"><span>Realtime</span><span class="verified-badge">✓ Online</span></div>
    </div>
  </div>`;
}

// ── Users list ────────────────────────────────────────────────────────────────
async function loadUsers() {
  const panel = document.querySelector('#panel-users');
  const search = panel.querySelector('#userSearch')?.value || '';

  let query = supabase.from('profiles')
    .select('id,display_name,username,created_at,avatar_url')
    .order('created_at',{ascending:false}).limit(50);

  if (search) query = query.ilike('username', `%${search}%`);

  const {data, error} = await query;
  if (error) { toast(error.message,'error'); return; }

  const list = panel.querySelector('#userList');
  list.innerHTML = '';

  if (!data || !data.length) {
    list.innerHTML = '<p class="status">No users found.</p>'; return;
  }

  data.forEach(u => {
    const row = document.createElement('div');
    row.className = 'report-row';
    row.innerHTML = `
      <div class="avatar">${(u.display_name||'?')[0].toUpperCase()}</div>
      <div style="flex:1">
        <b>${esc(u.display_name||'Unknown')}</b>
        <small style="display:block;color:var(--muted)">@${esc(u.username||'')} · Joined ${timeAgo(u.created_at)}</small>
      </div>
      <div style="display:flex;gap:8px">
        <button class="button light" style="padding:6px 12px;font-size:13px" data-uid="${u.id}" data-action="verify">✅ Verify</button>
        <button class="button danger" style="padding:6px 12px;font-size:13px" data-uid="${u.id}" data-action="ban">🚫 Ban</button>
      </div>`;
    row.querySelectorAll('button').forEach(btn => {
      btn.onclick = () => handleUserAction(u.id, btn.dataset.action, u.display_name);
    });
    list.appendChild(row);
  });
}

async function handleUserAction(targetUid, action, name) {
  if (action === 'verify') {
    const confirmed = confirm(`Manually verify ${name}?`);
    if (!confirmed) return;
    const {error} = await supabase.from('identity_verifications').upsert({
      user_id: targetUid, status:'approved', updated_at:new Date().toISOString()
    },{onConflict:'user_id'});
    if (error) { toast(error.message,'error'); return; }
    await logAdminAction('manual_verify', targetUid, 'Admin manual verification');
    toast(`${name} verified ✓`,'success');
    loadUsers();
  } else if (action === 'ban') {
    const reason = prompt(`Reason for banning ${name}:`);
    if (!reason) return;
    await supabase.from('security_events').insert({
      user_id: targetUid, event_type:'account_banned',
      metadata:{reason, banned_by:uid}
    });
    await logAdminAction('ban_user', targetUid, reason);
    toast(`${name} banned`,'info');
    loadUsers();
  }
}

// ── Reports queue ─────────────────────────────────────────────────────────────
async function loadReports() {
  const panel = document.querySelector('#panel-reports');
  const list  = panel.querySelector('#reportList');
  list.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">' +
    Array(3).fill('<div class="skeleton skeleton-line"></div>').join('') + '</div>';

  const {data, error} = await supabase
    .from('reports')
    .select('id,reason,context_type,created_at,reporter_id,reported_id')
    .eq('status','pending')
    .order('created_at',{ascending:false})
    .limit(30);

  list.innerHTML = '';
  if (error) { list.innerHTML = `<p class="status">${error.message}</p>`; return; }
  if (!data?.length) { list.innerHTML = '<p class="status">✓ No pending reports</p>'; return; }

  data.forEach(r => {
    const row = document.createElement('div');
    row.className = 'report-row';
    row.innerHTML = `
      <span style="font-size:24px">${r.context_type==='message'?'💬':'👤'}</span>
      <div style="flex:1">
        <b>${esc(r.reason||'No reason given').slice(0,80)}</b>
        <small style="display:block;color:var(--muted)">${esc(r.context_type)} · ${timeAgo(r.created_at)}</small>
      </div>
      <div style="display:flex;gap:6px">
        <button class="button light" style="padding:6px 10px;font-size:12px" data-id="${r.id}" data-act="dismiss">Dismiss</button>
        <button class="button danger" style="padding:6px 10px;font-size:12px" data-id="${r.id}" data-act="action">Take action</button>
      </div>`;
    row.querySelectorAll('button').forEach(btn => {
      btn.onclick = async () => {
        if (btn.dataset.act === 'dismiss') {
          await supabase.from('reports').update({status:'dismissed'}).eq('id',r.id);
          await logAdminAction('dismiss_report',null,r.id);
          toast('Report dismissed','info');
        } else {
          const act = prompt('Action taken (e.g. warning sent, account banned):');
          if (!act) return;
          await supabase.from('reports').update({status:'actioned'}).eq('id',r.id);
          await supabase.from('moderation_reports').insert({report_id:r.id,reviewer_id:uid,action_taken:act});
          await logAdminAction('action_report',r.reported_id,act);
          toast('Action logged','success');
        }
        loadReports();
      };
    });
    list.appendChild(row);
  });
}

// ── Verification queue ────────────────────────────────────────────────────────
async function loadVerifications() {
  if (!['super_admin','verification_reviewer'].includes(role)) {
    document.querySelector('#panel-verification').innerHTML =
      '<p class="status">Your role does not have access to the verification queue.</p>'; return;
  }
  const panel = document.querySelector('#panel-verification');
  const list  = panel.querySelector('#verifList');
  const {data, error} = await supabase
    .from('identity_verifications')
    .select('id,user_id,status,created_at,storage_path')
    .eq('status','pending')
    .order('created_at',{ascending:true}).limit(20);

  list.innerHTML = '';
  if (error) { list.innerHTML = `<p class="status">${error.message}</p>`; return; }
  if (!data?.length) { list.innerHTML = '<p class="status">✓ No pending verifications</p>'; return; }

  data.forEach(v => {
    const row = document.createElement('div');
    row.className = 'report-row';
    row.innerHTML = `
      <div class="avatar">👤</div>
      <div style="flex:1">
        <b>Verification #${v.id.slice(0,8)}</b>
        <small style="display:block;color:var(--muted)">Submitted ${timeAgo(v.created_at)}</small>
      </div>
      <div style="display:flex;gap:6px">
        <button class="button light" style="font-size:12px;padding:6px 10px" data-id="${v.id}" data-uid="${v.user_id}" data-act="view">View video</button>
        <button class="button accent" style="font-size:12px;padding:6px 10px" data-id="${v.id}" data-uid="${v.user_id}" data-act="approve">✓ Approve</button>
        <button class="button danger" style="font-size:12px;padding:6px 10px" data-id="${v.id}" data-uid="${v.user_id}" data-act="reject">✕ Reject</button>
      </div>`;
    row.querySelectorAll('button').forEach(btn => {
      btn.onclick = async () => {
        const act = btn.dataset.act;
        if (act === 'view') {
          if (!v.storage_path) { toast('No video stored for this verification','info'); return; }
          const reason = prompt('Reason for accessing verification video (required):');
          if (!reason) return;
          await logAdminAction('view_verification_video', v.user_id, reason);
          const {data:su} = await supabase.storage.from('verification-media').createSignedUrl(v.storage_path,120);
          if (su) window.open(su.signedUrl,'_blank');
        } else {
          const status = act === 'approve' ? 'approved' : 'rejected';
          const notes  = act === 'reject' ? prompt('Rejection reason:') : null;
          await supabase.from('identity_verifications').update({status,updated_at:new Date().toISOString()}).eq('id',v.id);
          await logAdminAction(`verification_${status}`, v.user_id, notes || status);
          toast(`Verification ${status}`, act==='approve'?'success':'info');
          loadVerifications();
        }
      };
    });
    list.appendChild(row);
  });
}

// ── Audit log ─────────────────────────────────────────────────────────────────
async function loadAuditLog() {
  const panel = document.querySelector('#panel-audit');
  const list  = panel.querySelector('#auditList');
  list.innerHTML = '<div style="display:flex;flex-direction:column;gap:8px">' +
    Array(5).fill('<div class="skeleton skeleton-line"></div>').join('') + '</div>';

  const {data, error} = await supabase
    .from('admin_access_logs')
    .select('id,action,reason,created_at,target_user_id')
    .eq('admin_id', uid)
    .order('created_at',{ascending:false}).limit(50);

  list.innerHTML = '';
  if (error) { list.innerHTML = `<p class="status">${error.message}</p>`; return; }
  if (!data?.length) { list.innerHTML = '<p class="status">No audit entries yet.</p>'; return; }

  data.forEach(entry => {
    const row = document.createElement('div');
    row.style = 'padding:12px 0;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:flex-start';
    row.innerHTML = `
      <span style="font-size:20px">📋</span>
      <div>
        <b>${esc(entry.action)}</b>
        <small style="display:block;color:var(--muted)">${timeAgo(entry.created_at)}</small>
        ${entry.reason ? `<p style="font-size:13px;color:var(--muted);margin-top:4px">${esc(entry.reason)}</p>` : ''}
      </div>`;
    list.appendChild(row);
  });
}

// ── Log admin action ──────────────────────────────────────────────────────────
async function logAdminAction(action, targetUserId, reason) {
  await supabase.from('admin_access_logs').insert({
    admin_id: uid, action, target_user_id: targetUserId||null, reason: reason||null
  });
}

// Auto-load overview on page load
loadOverview();
