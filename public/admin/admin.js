let users = [];
let unlinkedMembers = [];
let teams = [];
let pricingRules = [];
let defaultPricingRules = [];
let currentTab = 'users';
let editingUser = null;
let editingPricing = null;

let currentAdminSession = null;

// Helpers
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

async function loadSession() {
  const res = await fetch('/api/auth/me');
  if (!res.ok) {
    window.location.href = '/';
    return;
  }
  const session = await res.json();
  if (session.role !== 'superadmin') {
    window.location.href = '/';
    return;
  }
  currentAdminSession = session;
  const userEl = $('#admin-user-name');
  if (userEl) userEl.textContent = session.displayName || session.username;

  setupAdminProfileHandlers();

  const boot = $('#boot-loading');
  if (boot) boot.hidden = true;
  $('#admin-app').hidden = false;
}

function setupAdminProfileHandlers() {
  const dialog = $('#admin-profile-dialog');
  if (!dialog || dialog._initialized) return;
  dialog._initialized = true;

  $('#admin-profile-btn')?.addEventListener('click', () => {
    if (!dialog) return;
    const usernameEl = $('#admin-profile-username-val');
    if (usernameEl) usernameEl.textContent = currentAdminSession?.username || 'admin';

    const nameInput = $('#admin-profile-display-name');
    if (nameInput) nameInput.value = currentAdminSession?.displayName || currentAdminSession?.username || '';

    const curPwd = $('#admin-profile-current-password');
    if (curPwd) curPwd.value = '';
    const newPwd = $('#admin-profile-new-password');
    if (newPwd) newPwd.value = '';
    const confPwd = $('#admin-profile-confirm-password');
    if (confPwd) confPwd.value = '';

    const errEl = $('#admin-profile-error-msg');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }

    dialog.showModal();
  });

  $('#cancel-admin-profile-btn')?.addEventListener('click', () => {
    dialog.close();
  });

  $('#admin-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const errEl = $('#admin-profile-error-msg');
    const submitBtn = $('#save-admin-profile-btn');
    if (errEl) {
      errEl.hidden = true;
      errEl.textContent = '';
    }

    const displayName = ($('#admin-profile-display-name')?.value || '').trim();
    const currentPassword = $('#admin-profile-current-password')?.value || '';
    const newPassword = $('#admin-profile-new-password')?.value || '';
    const confirmPassword = $('#admin-profile-confirm-password')?.value || '';

    if (displayName.length < 2) {
      if (errEl) {
        errEl.textContent = 'Display name must be at least 2 characters long.';
        errEl.hidden = false;
      }
      return;
    }

    if (newPassword) {
      if (newPassword.length < 6) {
        if (errEl) {
          errEl.textContent = 'New password must be at least 6 characters long.';
          errEl.hidden = false;
        }
        return;
      }
      if (newPassword !== confirmPassword) {
        if (errEl) {
          errEl.textContent = 'New passwords do not match.';
          errEl.hidden = false;
        }
        return;
      }
      if (!currentPassword) {
        if (errEl) {
          errEl.textContent = 'Please enter your current password to change password.';
          errEl.hidden = false;
        }
        return;
      }
    }

    const origText = submitBtn ? submitBtn.textContent : '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Saving…';
    }

    try {
      const payload = { displayName };
      if (newPassword) {
        payload.currentPassword = currentPassword;
        payload.newPassword = newPassword;
      }

      const res = await fetch('/api/auth/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      if (currentAdminSession) {
        currentAdminSession.displayName = displayName;
      }
      const userEl = $('#admin-user-name');
      if (userEl) userEl.textContent = displayName;

      dialog.close();
      if (window.showToast) {
        window.showToast('Profile updated successfully!', { type: 'success' });
      }
    } catch (err) {
      if (errEl) {
        errEl.textContent = err.message;
        errEl.hidden = false;
      } else if (window.showToast) {
        window.showToast(err.message, { type: 'error' });
      }
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = origText;
      }
    }
  });
}

async function loadData() {
  if (typeof window.setDataLoading === 'function') {
    window.setDataLoading(true, 'Loading accounts…');
  }
  try {
    const res = await fetch('/api/admin/users');
    if (!res.ok) throw new Error('Failed to load user list');
    const data = await res.json();
    
    if (data.needsMigration) {
      const btn = $('#migrate-btn');
      if (btn) btn.hidden = false;
      const tbody = $('#users-tbody');
      if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="error admin-empty">Users table does not exist. Run database migration to initialize it.</td></tr>`;
      return;
    } else {
      const btn = $('#migrate-btn');
      if (btn) btn.hidden = true;
    }

    users = data.users || [];
    unlinkedMembers = data.unlinkedMembers || [];
    teams = data.teams || [];
    renderUsers();
    renderMembers();
    renderTeams();
    populateMemberDropdown();
    populateTeamDropdown();
    populateMemberFormTeamDropdown();
    await loadPricing();
  } catch (err) {
    window.showToast(err.message, { type: 'error' });
  } finally {
    if (typeof window.setDataLoading === 'function') {
      window.setDataLoading(false);
    }
  }
}

function populateTeamDropdown() {
  const select = $('#uf-team');
  if (select) {
    select.innerHTML = `
      <option value="">— none —</option>
      <option value="new">— create new team —</option>
    `;
    teams.forEach(t => {
      select.innerHTML += `<option value="${t.id}">${esc(t.name)}</option>`;
    });
  }

  // Populate multi-team checkboxes for user form
  const ufBoxes = $('#uf-teams-checkboxes');
  if (ufBoxes) {
    if (!teams.length) {
      ufBoxes.innerHTML = '<span class="muted">No teams created yet.</span>';
    } else {
      ufBoxes.innerHTML = teams.map(t => `
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:13px;">
          <input type="checkbox" name="uf-team-cb" value="${t.id}" />
          <span>🛡️ ${esc(t.name)}</span>
        </label>
      `).join('');
    }
  }

  // Populate multi-team checkboxes for member form
  const mfBoxes = $('#mf-teams-checkboxes');
  if (mfBoxes) {
    if (!teams.length) {
      mfBoxes.innerHTML = '<span class="muted">No teams created yet.</span>';
    } else {
      mfBoxes.innerHTML = teams.map(t => `
        <label style="display:flex; align-items:center; gap:6px; cursor:pointer; font-size:13px;">
          <input type="checkbox" name="mf-team-cb" value="${t.id}" />
          <span>🛡️ ${esc(t.name)}</span>
        </label>
      `).join('');
    }
  }
}

function populateMemberFormTeamDropdown() {
  populateTeamDropdown();
}

function renderUsers() {
  const tbody = $('#users-tbody');
  if (!tbody) return;
  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="muted admin-empty">No users yet. Create one to get started.</td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const lastLogin = u.last_login_at ? new Date(u.last_login_at).toLocaleString() : 'Never';
    const status = u.active ? '<span class="status-badge active-badge">Active</span>' : '<span class="status-badge inactive-badge">Inactive</span>';
    const sessionCount = u.session_count || 0;
    
    const teamBadges = (u.teams && u.teams.length > 0)
      ? `<div style="display:flex; flex-wrap:wrap; gap:4px;">` + u.teams.map(t => `<span class="team-badge" style="background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; font-size:11px;">🛡️ ${esc(t.name)}</span>`).join('') + `</div>`
      : (u.team_name && u.team_name !== '—' ? `<span class="team-badge" style="background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; font-size:11px;">🛡️ ${esc(u.team_name)}</span>` : '<span class="muted">—</span>');

    return `
      <tr>
        <td><strong>${esc(u.username)}</strong></td>
        <td>${esc(u.display_name)}</td>
        <td><code class="role-badge">${esc(u.role)}</code></td>
        <td>${teamBadges}</td>
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
    tbody.innerHTML = `<tr><td colspan="4" class="muted admin-empty">All members are linked to user accounts.</td></tr>`;
    return;
  }

  tbody.innerHTML = unlinkedMembers.map(m => {
    const teamBadges = (m.teams && m.teams.length > 0)
      ? `<div style="display:flex; flex-wrap:wrap; gap:4px;">` + m.teams.map(t => `<span class="team-badge" style="background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; font-size:11px;">🛡️ ${esc(t.name)}</span>`).join('') + `</div>`
      : `<span class="team-badge" style="background:rgba(255,255,255,0.08); padding:2px 6px; border-radius:4px; font-size:11px;">🛡️ ${esc(m.team_name || 'Independent')}</span>`;

    return `
      <tr>
        <td><strong>${esc(m.display_name)}</strong></td>
        <td>${teamBadges}</td>
        <td><span class="muted">Needs User Account</span></td>
        <td>
          <div class="actions-cell">
            <button class="hbtn small-btn edit-member-btn" data-id="${m.id}">Edit</button>
            <button class="hbtn small-btn danger-btn delete-member-btn" data-id="${m.id}" data-name="${esc(m.display_name)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.edit-member-btn').forEach(b => b.addEventListener('click', () => editMember(b.dataset.id)));
  tbody.querySelectorAll('.delete-member-btn').forEach(b => b.addEventListener('click', () => deleteMember(b.dataset.id, b.dataset.name)));
}

function renderTeams() {
  const tbody = $('#teams-tbody');
  if (!tbody) return;
  if (!teams.length) {
    tbody.innerHTML = `<tr><td colspan="3" class="muted admin-empty">No teams found.</td></tr>`;
    return;
  }

  tbody.innerHTML = teams.map(t => {
    const memberCount = t.member_count || 0;
    return `
      <tr>
        <td><strong>${esc(t.name)}</strong></td>
        <td>${memberCount} member(s)</td>
        <td>
          <div class="actions-cell">
            <button class="hbtn small-btn edit-team-btn" data-id="${t.id}">Edit</button>
            <button class="hbtn small-btn danger-btn delete-team-btn" data-id="${t.id}" data-name="${esc(t.name)}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.edit-team-btn').forEach(b => b.addEventListener('click', () => editTeam(b.dataset.id)));
  tbody.querySelectorAll('.delete-team-btn').forEach(b => b.addEventListener('click', () => deleteTeam(b.dataset.id, b.dataset.name)));
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
  $('#uf-username').disabled = false;
  $('#uf-displayname').value = user.display_name;
  $('#uf-role').value = user.role;
  $('#uf-password').placeholder = 'Leave blank to keep current password';
  
  // Show team dropdown only for admins
  if (user.role === 'admin') {
    $('#field-uf-team').hidden = false;
    $('#uf-team').value = user.team_id || '';
  } else {
    $('#field-uf-team').hidden = true;
    $('#uf-team').value = '';
  }
  $('#field-uf-new-team').hidden = true;
  $('#uf-new-team').value = '';

  // Select team checkboxes corresponding to user's teams
  const userTeamIds = (user.teams || []).map(t => t.id);
  document.querySelectorAll('input[name="uf-team-cb"]').forEach(cb => {
    cb.checked = userTeamIds.includes(cb.value) || (user.team_id && user.team_id === cb.value);
  });

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
  $('#field-uf-team').hidden = true;
  $('#field-uf-new-team').hidden = true;
  $('#user-form-wrap').hidden = true;
  $('#uf-error').hidden = true;
  document.querySelectorAll('input[name="uf-team-cb"]').forEach(cb => { cb.checked = false; });
  populateMemberDropdown();
  populateTeamDropdown();
}

async function handleFormSubmit(e) {
  e.preventDefault();
  const errorEl = $('#uf-error');
  errorEl.hidden = true;
  
  const id = $('#uf-id').value;
  const username = $('#uf-username').value.trim().toLowerCase();
  const displayName = $('#uf-displayname').value.trim();
  const password = $('#uf-password').value;
  const role = $('#uf-role').value;
  const memberId = $('#uf-member').value || null;

  if (!displayName || (!id && !username) || (!id && !password)) {
    errorEl.textContent = 'Please fill out all required fields';
    errorEl.hidden = false;
    return;
  }

  // Username validation
  if (username) {
    if (username.length < 2) {
      errorEl.textContent = 'Username must be at least 2 characters long';
      errorEl.hidden = false;
      return;
    }
    if (!/^[a-z0-9_.-]+$/.test(username)) {
      errorEl.textContent = 'Username can only contain letters, numbers, dots, hyphens, and underscores';
      errorEl.hidden = false;
      return;
    }
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

  // Collect selected teamIds from checkboxes
  const selectedTeamIds = Array.from(document.querySelectorAll('input[name="uf-team-cb"]:checked')).map(cb => cb.value);

  const payload = { displayName, role, memberId, teamId, newTeamName, teamIds: selectedTeamIds };
  if (!id) {
    payload.username = username;
    payload.password = password;
  } else {
    if (username) payload.username = username;
    if (password) payload.password = password;
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

    if (data.apiKey) {
      // Show the generated sync command details
      const banner = $('#new-password-banner');
      const val = $('#new-password-value');
      if (banner && val) {
        let msg = `<b>User:</b> ${username || data.user.username}<br>`;
        if (password) {
          msg += `<b>Temp Password:</b> ${password}<br>`;
        }
        msg += `<b>API Key:</b> <code>${data.apiKey}</code><br><br>`;
        if (data.installCommandMac) {
          msg += `<b>🍎 Mac Command:</b><br><pre style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 12px; margin: 4px 0 12px 0; user-select: all;">${data.installCommandMac}</pre>`;
        }
        if (data.installCommandWin) {
          msg += `<b>🪟 Windows Command:</b><br><pre style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 4px; overflow-x: auto; font-family: monospace; font-size: 12px; margin: 4px 0 12px 0; user-select: all;">${data.installCommandWin}</pre>`;
        }
        val.innerHTML = msg;
        banner.hidden = false;
      }
    } else {
      window.showToast(id ? `User "${displayName}" updated.` : `User "${displayName}" created.`, { type: 'success' });
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
    window.showToast(`Password reset for "${username}".`, { type: 'success' });
  } catch (err) {
    window.showToast(err.message, { type: 'error' });
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
    window.showToast(`User "${username}" deleted.`, { type: 'success' });
  } catch (err) {
    window.showToast(err.message, { type: 'error' });
  }
}

// Members CRUD
function editMember(id) {
  const member = unlinkedMembers.find(m => m.id === id);
  if (!member) return;

  cancelMemberForm();
  $('#mf-id').value = member.id;
  $('#mf-displayname').value = member.display_name;
  
  const memberTeamIds = (member.teams || []).map(t => t.id);
  document.querySelectorAll('input[name="mf-team-cb"]').forEach(cb => {
    cb.checked = memberTeamIds.includes(cb.value) || (member.team_id && member.team_id === cb.value);
  });

  $('#member-form-title').textContent = 'Edit Member';
  $('#member-form-wrap').hidden = false;
  $('#mf-displayname').focus();
}

function cancelMemberForm() {
  $('#mf-id').value = '';
  $('#mf-displayname').value = '';
  document.querySelectorAll('input[name="mf-team-cb"]').forEach(cb => { cb.checked = false; });
  $('#member-form-wrap').hidden = true;
  $('#mf-error').hidden = true;
}

async function handleMemberFormSubmit(e) {
  e.preventDefault();
  const errorEl = $('#mf-error');
  errorEl.hidden = true;

  const id = $('#mf-id').value;
  const displayName = $('#mf-displayname').value.trim();
  const selectedTeamIds = Array.from(document.querySelectorAll('input[name="mf-team-cb"]:checked')).map(cb => cb.value);

  if (!displayName) {
    errorEl.textContent = 'Display name is required';
    errorEl.hidden = false;
    return;
  }

  try {
    const res = await fetch('/api/admin/members', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, displayName, teamIds: selectedTeamIds })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Update failed');

    window.showToast(`Member "${displayName}" updated.`, { type: 'success' });
    cancelMemberForm();
    await loadData();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

async function deleteMember(id, name) {
  if (!confirm(`Are you sure you want to permanently delete member "${name}"?\nThis will cascade delete any associated API keys and session logs.`)) return;

  try {
    const res = await fetch(`/api/admin/members?id=${id}`, {
      method: 'DELETE'
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Delete failed');

    await loadData();
    window.showToast(`Member "${name}" deleted.`, { type: 'success' });
  } catch (err) {
    window.showToast(err.message, { type: 'error' });
  }
}

// Teams CRUD
function editTeam(id) {
  const team = teams.find(t => t.id === id);
  if (!team) return;

  cancelTeamForm();
  $('#tf-id').value = team.id;
  $('#tf-name').value = team.name;
  $('#team-form-title').textContent = 'Edit Team';
  $('#team-form-wrap').hidden = false;
  $('#tf-name').focus();
}

function cancelTeamForm() {
  $('#tf-id').value = '';
  $('#tf-name').value = '';
  $('#team-form-wrap').hidden = true;
  $('#tf-error').hidden = true;
}

async function handleTeamFormSubmit(e) {
  e.preventDefault();
  const errorEl = $('#tf-error');
  errorEl.hidden = true;

  const id = $('#tf-id').value;
  const name = $('#tf-name').value.trim();

  if (!name) {
    errorEl.textContent = 'Team name is required';
    errorEl.hidden = false;
    return;
  }

  const method = id ? 'PUT' : 'POST';

  try {
    const res = await fetch('/api/admin/teams', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(id ? { id, name } : { name })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');

    window.showToast(id ? `Team "${name}" updated.` : `Team "${name}" created.`, { type: 'success' });
    cancelTeamForm();
    await loadData();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  }
}

// Model Pricing & Global Sync
async function loadPricing() {
  try {
    const res = await fetch('/api/admin/pricing');
    if (!res.ok) throw new Error('Failed to load model pricing');
    const data = await res.json();
    pricingRules = data.pricing || [];
    defaultPricingRules = data.defaultRules || [];
    renderPricing();
    populatePricingTeamDropdown();
  } catch (err) {
    console.error('[loadPricing error]', err);
  }
}

function populatePricingTeamDropdown() {
  const select = $('#pf-team');
  if (!select) return;
  const currentVal = select.value || 'global';
  select.innerHTML = `<option value="global">🌐 Global (Applies to all teams &amp; members)</option>`;
  teams.forEach(t => {
    select.innerHTML += `<option value="${t.id}">🛡️ ${esc(t.name)} (Team Override)</option>`;
  });
  select.value = currentVal;
}

function renderPricing() {
  const tbody = $('#pricing-tbody');
  const countBadge = $('#pricing-count-badge');
  if (countBadge) {
    countBadge.textContent = `${pricingRules.length} rule${pricingRules.length === 1 ? '' : 's'}`;
  }

  if (tbody) {
    if (!pricingRules.length) {
      tbody.innerHTML = `<tr><td colspan="6" class="muted admin-empty">No custom pricing rules defined yet. System uses baseline reference rates below.</td></tr>`;
    } else {
      tbody.innerHTML = pricingRules.map(r => {
        const isGlobal = !r.team_id;
        const scopeBadge = isGlobal
          ? `<span class="scope-badge-global">🌐 Global</span>`
          : `<span class="scope-badge-team">🛡️ ${esc(r.team_name || 'Team Override')}</span>`;

        return `
          <tr>
            <td><strong><code>${esc(r.model_pattern)}</code></strong></td>
            <td>${scopeBadge}</td>
            <td>$${Number(r.cost_in_per_m).toFixed(4)}</td>
            <td>$${Number(r.cost_out_per_m).toFixed(4)}</td>
            <td>$${Number(r.cost_cache_read_per_m).toFixed(4)}</td>
            <td>
              <div class="actions-cell">
                <button class="hbtn small-btn edit-pricing-btn" data-id="${r.id}">Edit</button>
                <button class="hbtn small-btn danger-btn delete-pricing-btn" data-id="${r.id}" data-pattern="${esc(r.model_pattern)}">Delete</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.edit-pricing-btn').forEach(b => b.addEventListener('click', () => editPricing(b.dataset.id)));
      tbody.querySelectorAll('.delete-pricing-btn').forEach(b => b.addEventListener('click', () => deletePricing(b.dataset.id, b.dataset.pattern)));
    }
  }

  const defTbody = $('#default-pricing-tbody');
  if (defTbody && defaultPricingRules.length) {
    defTbody.innerHTML = defaultPricingRules.map(d => {
      return `
        <tr>
          <td><strong>${esc(d.label || d.model_pattern)}</strong> ${d.model_pattern ? `<code style="font-size:11px; margin-left:6px; opacity:0.75;">${esc(d.model_pattern)}</code>` : '<span class="muted" style="font-size:11px; margin-left:6px;">(Default Fallback)</span>'}</td>
          <td>$${Number(d.cost_in_per_m).toFixed(2)}</td>
          <td>$${Number(d.cost_out_per_m).toFixed(2)}</td>
          <td>$${Number(d.cost_cache_read_per_m).toFixed(2)}</td>
          <td>
            <button class="hbtn small-btn quick-override-btn" data-pattern="${esc(d.model_pattern)}" data-in="${d.cost_in_per_m}" data-out="${d.cost_out_per_m}" data-cache="${d.cost_cache_read_per_m}">Customize</button>
          </td>
        </tr>
      `;
    }).join('');

    defTbody.querySelectorAll('.quick-override-btn').forEach(b => {
      b.addEventListener('click', () => {
        cancelPricingForm();
        $('#pf-pattern').value = b.dataset.pattern;
        $('#pf-cost-in').value = b.dataset.in;
        $('#pf-cost-out').value = b.dataset.out;
        $('#pf-cost-cache').value = b.dataset.cache;
        $('#pricing-form-title').textContent = `Add Override for ${b.dataset.pattern || 'Fallback'}`;
        $('#pricing-form-wrap').hidden = false;
        $('#pf-team').focus();
      });
    });
  }
}

function editPricing(id) {
  const rule = pricingRules.find(r => r.id === id);
  if (!rule) return;

  editingPricing = rule;
  $('#pf-id').value = rule.id;
  $('#pf-team').value = rule.team_id || 'global';
  $('#pf-pattern').value = rule.model_pattern;
  $('#pf-cost-in').value = rule.cost_in_per_m;
  $('#pf-cost-out').value = rule.cost_out_per_m;
  $('#pf-cost-cache').value = rule.cost_cache_read_per_m;
  $('#pricing-form-title').textContent = `Edit Pricing Rule (${rule.model_pattern})`;
  $('#pricing-form-wrap').hidden = false;
  $('#pf-pattern').focus();
}

function cancelPricingForm() {
  editingPricing = null;
  $('#pf-id').value = '';
  $('#pf-team').value = 'global';
  $('#pf-pattern').value = '';
  $('#pf-cost-in').value = '';
  $('#pf-cost-out').value = '';
  $('#pf-cost-cache').value = '';
  $('#pricing-form-wrap').hidden = true;
  $('#pf-error').hidden = true;
}

async function handlePricingFormSubmit(e) {
  e.preventDefault();
  const errorEl = $('#pf-error');
  errorEl.hidden = true;

  const id = $('#pf-id').value;
  const teamId = $('#pf-team').value;
  const modelPattern = $('#pf-pattern').value.trim();
  const costInPerM = $('#pf-cost-in').value;
  const costOutPerM = $('#pf-cost-out').value;
  const costCacheReadPerM = $('#pf-cost-cache').value;

  if (!modelPattern) {
    errorEl.textContent = 'Model pattern or identifier is required';
    errorEl.hidden = false;
    return;
  }

  const submitBtn = $('#pf-submit');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving & Recalculating…';

  try {
    const res = await fetch('/api/admin/pricing', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: id || undefined,
        teamId: teamId === 'global' ? null : teamId,
        modelPattern,
        costInPerM: parseFloat(costInPerM) || 0,
        costOutPerM: parseFloat(costOutPerM) || 0,
        costCacheReadPerM: parseFloat(costCacheReadPerM) || 0,
        syncRecalc: true,
      }),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to save pricing rule');

    window.showToast(`Pricing rule for "${modelPattern}" saved and session costs recalculated.`, { type: 'success' });
    cancelPricingForm();
    await loadPricing();
  } catch (err) {
    errorEl.textContent = err.message;
    errorEl.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Save Pricing Rule';
  }
}

async function deletePricing(id, pattern) {
  if (!confirm(`Are you sure you want to delete the pricing rule for "${pattern}"?\nSession costs will be recalculated using remaining rules.`)) return;

  try {
    const res = await fetch(`/api/admin/pricing?id=${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to delete pricing rule');

    window.showToast(`Pricing rule for "${pattern}" deleted and costs recalculated.`, { type: 'success' });
    await loadPricing();
  } catch (err) {
    window.showToast(err.message, { type: 'error' });
  }
}

async function syncAllTeamsAndMembers() {
  const btn = $('#sync-all-btn');
  if (!btn) return;
  const icon = btn.querySelector('.sync-icon');
  
  if (!confirm('Broadcast sync to all developer machines and recalculate historical token costs across all teams and members?')) {
    return;
  }

  btn.disabled = true;
  if (icon) icon.classList.add('spinning');
  btn.innerHTML = `<span class="sync-icon spinning">🔄</span> Syncing & Recalculating…`;

  try {
    const res = await fetch('/api/admin/pricing/sync', { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Sync request failed');

    window.showToast(data.message || 'All teams & members synced successfully!', { type: 'success', duration: 6000 });
    await loadData();
  } catch (err) {
    window.showToast(err.message, { type: 'error' });
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<span class="sync-icon">🔄</span> Sync for All Teams &amp; Members`;
  }
}

// Tabs
function switchTab(tabId) {
  currentTab = tabId;
  document.querySelectorAll('.admin-sidebar-nav button').forEach(b => {
    const active = b.dataset.tab === tabId;
    b.classList.toggle('active', active);
    b.setAttribute('aria-selected', String(active));
    b.tabIndex = active ? 0 : -1;
  });
  document.querySelectorAll('.admin-tab').forEach(t => {
    t.hidden = t.id !== tabId;
  });
  closeMobileNav();
}

/** Hamburger toggle for the off-canvas sidebar on narrow (mobile) viewports. */
function setupMobileNav() {
  const layout = $('#admin-app');
  const toggle = $('#admin-nav-toggle');
  const overlay = $('#admin-nav-overlay');
  if (!layout || !toggle || !overlay) return;

  toggle.addEventListener('click', () => {
    const isOpen = layout.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  overlay.addEventListener('click', () => closeMobileNav());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMobileNav();
  });
}

function closeMobileNav() {
  const layout = $('#admin-app');
  const toggle = $('#admin-nav-toggle');
  if (!layout) return;
  layout.classList.remove('nav-open');
  toggle?.setAttribute('aria-expanded', 'false');
}

// Boot
(async () => {
  await loadSession();
  await loadData();

  // Tab buttons
  document.querySelectorAll('.admin-sidebar-nav button').forEach(b => {
    b.addEventListener('click', () => switchTab(b.dataset.tab));
  });
  setupMobileNav();

  // Action buttons
  $('#migrate-btn')?.addEventListener('click', async () => {
    const btn = $('#migrate-btn');
    btn.disabled = true;
    btn.textContent = 'Migrating database…';
    try {
      const res = await fetch('/api/admin/migrate', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Migration failed');
      window.showToast('Migration successful — database table initialized.', { type: 'success' });
      btn.hidden = true;
      await loadData();
    } catch (err) {
      window.showToast(err.message, { type: 'error' });
      btn.disabled = false;
      btn.textContent = 'Run database migration';
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
    $('#field-uf-team').hidden = !showTeam;
    if (!showTeam) {
      $('#uf-team').value = '';
      $('#field-uf-new-team').hidden = true;
      $('#uf-new-team').value = '';
    }
  });

  $('#uf-team')?.addEventListener('change', (e) => {
    const showNewTeam = e.target.value === 'new';
    $('#field-uf-new-team').hidden = !showNewTeam;
    if (!showNewTeam) {
      $('#uf-new-team').value = '';
    }
  });

  // Member form listeners
  $('#mf-cancel')?.addEventListener('click', cancelMemberForm);
  $('#member-form')?.addEventListener('submit', handleMemberFormSubmit);

  // Team form listeners
  $('#create-team-btn')?.addEventListener('click', () => {
    cancelTeamForm();
    $('#team-form-title').textContent = 'Add Team';
    $('#team-form-wrap').hidden = false;
    $('#tf-name').focus();
  });
  $('#tf-cancel')?.addEventListener('click', cancelTeamForm);
  $('#team-form')?.addEventListener('submit', handleTeamFormSubmit);

  // Pricing listeners
  $('#create-pricing-btn')?.addEventListener('click', () => {
    cancelPricingForm();
    $('#pricing-form-title').textContent = 'Add Pricing Rule';
    $('#pricing-form-wrap').hidden = false;
    $('#pf-pattern').focus();
  });
  $('#pf-cancel')?.addEventListener('click', cancelPricingForm);
  $('#pricing-form')?.addEventListener('submit', handlePricingFormSubmit);
  $('#sync-all-btn')?.addEventListener('click', syncAllTeamsAndMembers);

  // Preset quick fill buttons
  document.querySelectorAll('.preset-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      cancelPricingForm();
      $('#pf-pattern').value = btn.dataset.pattern || '';
      $('#pf-cost-in').value = btn.dataset.in || '';
      $('#pf-cost-out').value = btn.dataset.out || '';
      $('#pf-cost-cache').value = btn.dataset.cache || '';
      $('#pricing-form-title').textContent = `Add Rule for ${btn.textContent || btn.dataset.pattern}`;
      $('#pricing-form-wrap').hidden = false;
      $('#pf-team').focus();
    });
  });

  // Logout
  $('#admin-logout-btn')?.addEventListener('click', async () => {
    await fetch('/api/auth/me', { method: 'POST' });
    window.location.href = '/';
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

