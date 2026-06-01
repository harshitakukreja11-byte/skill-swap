// frontend/signup.js
document.getElementById('signupForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  const can_teach = (document.getElementById('canTeach').value || '').split(',').map(s => s.trim()).filter(Boolean);
  const want_to_learn = (document.getElementById('wantLearn').value || '').split(',').map(s => s.trim()).filter(Boolean);

  if(!name || !email || !password){ alert('Please fill required fields'); return; }

  try {
    const res = await fetch('http://localhost:5001/api/signup', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ name, email, password, can_teach, want_to_learn })
    });
    const data = await res.json();
    if(!res.ok){ alert(data.error || 'Signup failed'); return; }
    localStorage.setItem('token', data.token);
    alert('Signup successful');
    window.location.href = 'dashboard.html';
  } catch(err){
    console.error(err);
    alert('Could not reach backend. Make sure it is running.');
  }
});
