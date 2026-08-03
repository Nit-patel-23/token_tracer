let users = [];
let unlinkedMembers = [];
let teams = [];
let currentTab = 'users';
let editingUser = null;

// Helpers
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function loadSession() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) {
    window.location.href = '/login';
    return;
  }
  const session = await res.json();
  if (session.role !== 'superadmin') {
    window.location.href = '/login';
    return;
  }
  const userEl = $('#admin-user-name');
  if (userEl) userEl.textContent = session.displayName || session.username;

  $('#admin-app').hidden = false;
}

async function loadData() {
  try {
    const res = await fetch('/api/admin/users');
    if (!res.ok) throw new Error('Failed to load user list');
    const data = await res.json();
    
    if (data.needsMigration) {
      const btn = $('#migrate-btn');
      if (btn) btn.style.display = 'block';
      const tbody = $('#users-tbody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="error text-center" style="padding: 20px;">⚠️ Users table does not exist in the database. Please click the "Run Database Migration" button above to initialize it.</td></tr>`;
      return;
    } else {
      const btn = $('#migrate-btn');
      if (btn) btn.style.display = 'none';
    }

    users = data.users || [];
    unlinkedMembers = data.unlinkedMembers || [];
    teams = data.teams || [];
    renderUsers();
    renderMembers();
    populateMemberDropdown();
    populateTeamDropdown();
  } catch (err) {
    alert(err.message);
  }
}

function populateTeamDropdown() {
  const select = $('#uf-team');
  if (!select) return;
  select.innerHTML = `
    <option value="">— none —</option>
    <option value="new">— create new team —</option>
  `;
  teams.forEach(t => {
    select.innerHTML += `<option value="${t.id}">${esc(t.name)}</option>`;
  });
}

function renderUsers() {
  const tbody = $('#users-tbody');
  if (!tbody) return;
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="8" class="muted text-center">No users found. Create one above!</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const lastLogin = u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never';
    const hasKey = u.has_api_key ? '✅ Active' : '❌ None';
    const status = u.active ? '<span class="status-badge active-badge">Active</span>' : '<span class="status-badge inactive-badge">Inactive</span>';
    const sessionCount = u.session_count || 0;
    
    return `
      <tr>
        <td><strong>${esc(u.username)}</strong></td>
        <td>${esc(u.display_name)}</td>
        <td><code class="role-badge">${esc(u.role)}</code></td>
        <td>
          ${u.member_name ? `<span class="linked-member">👤 ${esc(u.member_name)}</span>` : '<span class="muted">—</span>'}
        </td>
        <td>${sessionCount} sessions</td>
        <td><span class="muted">${lastLogin}</span></td>
        <td>${status}</td>
        <td>
          <div class="actions-cell">
            <button class="hbtn small-btn edit-btn" data-id="${u.id}">Edit</button>
            <button class="hbtn small-btn reset-btn" data-id="${u.id}" data-username="${esc(u.username)}">Reset PW</button>
            <button class="hbtn small-btn danger-btn delete-btn" data-id="${u.id}" data-username="${esc(u.username)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  // Wire action buttons
  tbody.querySelectorAll('.edit-btn').forEach(b => b.addEventListener('click', () => editUser(b.dataset.id)));
  tbody.querySelectorAll('.reset-btn').forEach(b => b.addEventListener('click', () => resetPassword(b.dataset.id, b.dataset.username)));
  tbody.querySelectorAll('.delete-btn').forEach(b => b.addEventListener('click', () => deleteUser(b.dataset.id, b.dataset.username)));
}

function renderMembers() {
  const tbody = $('#members-tbody');
  if (!tbody) return;
  if (!unlinkedMembers.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="muted text-center">All members are linked to user accounts.</td></tr>`;
    return;
  }

  tbody.innerHTML = unlinkedMembers.map(m => `
    <tr>
      <td><strong>${esc(m.display_name)}</strong></td>
      <td>${esc(m.team_name)}</td>
      <td><span class="muted">Needs User Account</span></td>
    </tr>
  `).join('');
}

function populateMemberDropdown() {
  const select = $('#uf-member');
  if (!select) return;
  
  select.innerHTML = `
    <option value="">— none —</option>
    <option value="new">— create new independent member —</option>
  `;
  
  unlinkedMembers.forEach(m => {
    select.innerHTML += `<option value="${m.id}">${esc(m.display_name)} (${esc(m.team_name)})</option>`;
  });
}

function editUser(id) {
  const user = users.find(u => u.id === id);
  if (!user) return;
  
  editingUser = user;
  $('#uf-id').value = user.id;
  $('#uf-username').value = user.username;
  $('#uf-username').disabled = true; // Cannot edit username
  $('#uf-displayname').value = user.display_name;
  $('#uf-role').value = user.role;
  $('#uf-password').placeholder = 'Leave blank to keep current password';
  
  // Show team dropdown only for admins
  if (user.role === 'admin') {
    $('#field-uf-team').style.display = 'block';
    $('#uf-team').value = user.team_id || '';
  } else {
    $('#field-uf-team').style.display = 'none';
    $('#uf-team').value = '';
  }
  $('#field-uf-new-team').style.display = 'none';
  $('#uf-new-team').value = '';

  // Temporarily add their own linked member to dropdown option list if they have one
  const select = $('#uf-member');
  select.innerHTML = `
    <option value="">— none —</option>
    <option value="new">— create new independent member —</option>
  `;
  if (user.member_id) {
    select.innerHTML += `<option value="${user.member_id}" selected>👤 ${esc(user.member_name)}</option>`;
  }
  unlinkedMembers.forEach(m => {
    select.innerHTML += `<option value="${m.id}">${esc(m.display_name)} (${esc(m.team_name)})</option>`;
  });

  $('#uf-member').value = user.member_id || '';
  $('#user-form-title').textContent = 'Edit User';
  $('#user-form-wrap').hidden = false;
  $('#uf-displayname').focus();
}

function cancelForm() {
  editingUser = null;
  $('#uf-id').value = '';
  $('#uf-username').value = '';
  $('#uf-username').disabled = false;
  $('#uf-displayname').value = '';
  $('#uf-password').value = '';
  $('#uf-password').placeholder = 'temporary password';
  $('#uf-role').value = 'user';
  $('#uf-member').value = '';
  $('#uf-team').value = '';
  $('#uf-new-team').value = '';
  $('#field-uf-team').style.display = 'none';
  $('#field-uf-new-team').style.display = 'none';
  $('#user-form-wrap').hidden = true;
  $('#uf-error').hidden = true;
  populateMemberDropdown();
  populateTeamDropdown();
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const errorEl = $('#uf-error');
  errorEl.hidden = true;
  
  const id = $('#uf-id').value;
  const username = $('#uf-username').value.trim();
  const displayName = $('#uf-displayname').value.trim();
  const password = $('#uf-password').value;
  const role = $('#uf-role').value;
  const memberId = $('#uf-member').value || null;

  if (!displayName || (!id && !username) || (!id && !password)) {
    errorEl.textContent = 'Please fill out all required fields';
    errorEl.hidden = false;
    return;
  }

  const teamVal = $('#uf-team').value;
  let teamId = null;
  let newTeamName = null;

  if (role === 'admin') {
    if (teamVal === 'new') {
      newTeamName = $('#uf-new-team').value.trim();
      if (!newTeamName) {
        errorEl.textContent = 'Please enter a name for the new team';
        errorEl.hidden = false;
        return;
      }
    } else if (teamVal) {
      teamId = teamVal;
    } else {
      errorEl.textContent = 'Please select or create a team for the admin account';
      errorEl.hidden = false;
      return;
    }
  }

  const payload = { displayName, role, memberId, teamId, newTeamName };
  if (!id) {
    payload.username = username;
    payload.password = password;
  } else if (password) {
    // If updating password on edit
    payload.password = password;
  }

  const url = '/api/admin/users';
  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id, ...payload } : payload)
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');

    if (!id && data.apiKey) {
      // If newly created user with member link, show the generated sync command details
      const banner = $('#new-password-banner');
      const val = $('#new-password-value');
      if (banner && val) {
        val.textContent = `User: ${username} | Temp Password: ${password} | API Key: ${data.apiKey}`;
        banner.hidden = false;
      }
    }

    cancelForm();
    await loadData();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

async function resetPassword(id, username) {
  if (!confirm(`Are you sure you want to reset the password for "${username}"?`)) return;
  
  try {
    const res = await fetch('/api/admin/users/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Password reset failed');

    const banner = $('#new-password-banner');
    const val = $('#new-password-value');
    if (banner && val) {
      val.textContent = `Temporary password for ${username}: ${data.newPassword}`;
      banner.hidden = false;
    }
  } catch (err) {
    alert(err.message);
  }
}

async function deleteUser(id, username) {
  if (!confirm(`Are you sure you want to permanently delete user "${username}"?`)) return;
  
  try {
    const res = await fetch(`/api/admin/users?id=${id}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed');
    
    await loadData();
  } catch (err) {
    alert(err.message);
  }
}

// Tabs
function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.admin-sidebar-nav button').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tabId);
  });
  document.querySelectorAll('.admin-tab').forEach(t => {
    t.hidden = t.id !== tabId;
  });
}

// Boot
(async () => {
  await loadSession();
  await loadData();

  // Tab buttons
  document.querySelectorAll('.admin-sidebar-nav button').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });

  // Action buttons
  $('#migrate-btn')?.addEventListener('click', async () => {
    const btn = $('#migrate-btn');
    btn.disabled = true;
    btn.textContent = 'Migrating database…';
    try {
      const res = await fetch('/api/admin/migrate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Migration failed');
      alert('Migration successful! Database table has been initialized.');
      btn.style.display = 'none';
      await loadData();
    } catch (err) {
      alert(err.message);
      btn.disabled = false;
      btn.textContent = '⚠️ Run Database Migration';
    }
  });

  $('#create-user-btn')?.addEventListener('click', () => {
    cancelForm();
    $('#user-form-title').textContent = 'Add User';
    $('#user-form-wrap').hidden = false;
    $('#uf-username').focus();
  });
  $('#uf-cancel')?.addEventListener('click', cancelForm);
  $('#user-form')?.addEventListener('submit', handleFormSubmit);

  // Form change toggles
  $('#uf-role')?.addEventListener('change', (e) => {
    const showTeam = e.target.value === 'admin';
    $('#field-uf-team').style.display = showTeam ? 'block' : 'none';
    if (!showTeam) {
      $('#uf-team').value = '';
      $('#field-uf-new-team').style.display = 'none';
      $('#uf-new-team').value = '';
    }
  });

  $('#uf-team')?.addEventListener('change', (e) => {
    const showNewTeam = e.target.value === 'new';
    $('#field-uf-new-team').style.display = showNewTeam ? 'block' : 'none';
    if (!showNewTeam) {
      $('#uf-new-team').value = '';
    }
  });

  // Logout
  $('#admin-logout-btn')?.addEventListener('click', async () => {
    await fetch('/api/auth/me', { method: 'POST' });
    window.location.href = '/login';
  });

  // Password banner close
  $('#new-password-close')?.addEventListener('click', () => {
    $('#new-password-banner').hidden = true;
  });
  $('#new-password-copy')?.addEventListener('click', () => {
    const txt = $('#new-password-value').textContent || '';
    navigator.clipboard.writeText(txt).then(() => {
      $('#new-password-copy').textContent = 'Copied!';
      setTimeout(() => { $('#new-password-copy').textContent = 'Copy'; }, 2000);
    });
  });
})();
