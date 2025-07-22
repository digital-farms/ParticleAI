document.getElementById('check-form').addEventListener('submit', async function(e) {
  e.preventDefault();
  const usernameInput = document.getElementById('username');
  let username = usernameInput.value.trim();
  if (!username) return;
  if (username[0] !== '@') username = '@' + username;
  usernameInput.value = username;

  const resultDiv = document.getElementById('result');
  resultDiv.textContent = 'Checking...';

  try {
    // fetch data.json (assume same folder)
    const resp = await fetch('data.json', {cache: 'no-store'});
    if (!resp.ok) throw new Error('Failed to load database');
    const data = await resp.json();
    // Поиск по nickname (case-insensitive, без @)
    const inputNick = username.replace(/^@/, '').toLowerCase();
    let found = null;
    for (const userId in data.users) {
      const nick = (data.users[userId].nickname || '').toLowerCase();
      if (nick === inputNick) {
        found = data.users[userId];
        break;
      }
    }
    if (found) {
      resultDiv.innerHTML = `<span style='color:#FE2C55;'>@${found.nickname}</span> has <b>${found.likes}</b> points!`;
    } else {
      resultDiv.innerHTML = `<span style='color:#FE2C55;'>${username}</span> not found in database.`;
    }
  } catch (err) {
    resultDiv.innerHTML = `<span style='color:#FE2C55;'>Error:</span> ${err.message}`;
  }
});
