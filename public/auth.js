const loginPanel = document.getElementById('login-panel');
const signupPanel = document.getElementById('signup-panel');
const authMessage = document.getElementById('auth-message');

function showAuthMessage(message, isError = true) {
  authMessage.textContent = message;
  authMessage.classList.toggle('error', isError);
}

document.querySelectorAll('[data-show]').forEach(button => {
  button.addEventListener('click', () => {
    const showSignup = button.dataset.show === 'signup';
    loginPanel.hidden = showSignup;
    signupPanel.hidden = !showSignup;
    showAuthMessage('');
  });
});

async function submitAuth(url, payload) {
  showAuthMessage('Please wait…', false);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Could not authenticate.');
    window.location.assign('/app');
  } catch (error) {
    showAuthMessage(error.message);
  }
}

document.getElementById('login-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  submitAuth('/api/auth/login', {
    identifier: form.get('identifier'),
    password: form.get('password')
  });
});

document.getElementById('signup-form').addEventListener('submit', event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  submitAuth('/api/auth/signup', {
    name: form.get('name'),
    username: form.get('username'),
    email: form.get('email'),
    password: form.get('password')
  });
});

fetch('/api/auth/me').then(response => {
  if (response.ok) window.location.assign('/app');
}).catch(() => {});
