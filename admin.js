let adminToken = null;

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('admin-login').addEventListener('click', async () => {
    const pass = document.getElementById('admin-pass').value;
    const res = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: pass }) });
    const j = await res.json();
    if (res.ok && j.token) {
      adminToken = j.token;
      document.getElementById('login-box').style.display = 'none';
      document.getElementById('admin-area').style.display = 'block';
      loadUsers();
    } else {
      alert('Login admin failed');
    }
  });

  document.getElementById('refresh-users').addEventListener('click', loadUsers);
});

async function loadUsers() {
  if (!adminToken) return;
  const res = await fetch('/api/admin/users', { headers: { 'Authorization': 'Bearer ' + adminToken } });
  if (!res.ok) {
    alert('Could not fetch users');
    return;
  }
  const j = await res.json();
  const tbody = document.getElementById('users-tbody');
  tbody.innerHTML = '';
  j.users.forEach(u => {
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${u.id}</td><td>${u.name || ''}</td><td>${u.email || ''}</td><td>${u.provider || ''}</td><td><button data-id="${u.id}" class="btn btn-outline btn-small temp-btn">Generar contraseña temporal</button></td>`;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.temp-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = e.target.getAttribute('data-id');
      const res = await fetch(`/api/admin/users/${id}/temp-password`, { method: 'POST', headers: { 'Authorization': 'Bearer ' + adminToken } });
      const j = await res.json();
      if (res.ok) {
        alert('Temporary password: ' + j.temp);
      } else {
        alert('Error generating temp password');
      }
    });
  });
}
