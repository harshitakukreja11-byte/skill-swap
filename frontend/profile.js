import { getToken, authFetch } from './utils.js';

document.addEventListener('DOMContentLoaded', async () => {
  try {
    const res = await authFetch('http://localhost:5001/api/me');
    const u = res.user;
    document.getElementById('name').value = u.name || '';
    document.getElementById('canTeach').value = (u.can_teach || []).join(', ');
    document.getElementById('wantLearn').value = (u.want_to_learn || []).join(', ');
    document.getElementById('avatar').value = u.avatar || '';
  } catch (e) {
    alert('Session expired');
    window.location.href = './login.html';
  }

  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const can_teach = (document.getElementById('canTeach').value || '').split(',').map(s => s.trim()).filter(Boolean);
    const want_to_learn = (document.getElementById('wantLearn').value || '').split(',').map(s => s.trim()).filter(Boolean);
    const avatar = document.getElementById('avatar').value.trim();

    const res = await fetch('http://localhost:5001/api/profile', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + getToken(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ can_teach, want_to_learn, avatar })
    });

    const data = await res.json();
    if (res.ok) {
      alert('Profile updated and matching triggered!');
    } else {
      alert(data.error || 'Error updating profile.');
    }
  });
});
