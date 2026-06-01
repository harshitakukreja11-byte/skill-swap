(async function () {
  try {
    const res = await fetch('http://localhost:5001/api/swaps');
    const data = await res.json();
    const list = document.getElementById('swapsList');
    if (!data.swaps.length)
      list.innerHTML = '<p>No swaps yet — sign up and create one!</p>';
    else
      list.innerHTML = data.swaps.map(s =>
        `<div class="swap-card"><b>${s.title}</b><p>${s.description}</p><small>By ${s.user_name}</small></div>`
      ).join('');
  } catch (e) {
    document.getElementById('swapsList').textContent = '❌ Failed to load swaps (check backend).';
  }
})();
