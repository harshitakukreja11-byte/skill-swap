// frontend/login.js
document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value.trim();
  if(!email || !password){ alert('Please enter credentials'); return; }

  try {
    const res = await fetch('http://localhost:5001/api/login', {
      method:'POST',
      headers:{ 'Content-Type':'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if(!res.ok){ alert(data.error || 'Login failed'); return; }
    localStorage.setItem('token', data.token);
    alert('Login successful');
    window.location.href = 'dashboard.html';
  } catch(err){
    console.error(err);
    alert('Could not reach backend. Make sure it is running.');
  }
});
