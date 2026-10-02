const SUPABASE_URL = 'https://piaxnqcafqkilwjxwwdm.supabase.co';
const SUPABASE_KEY = 'sb_publishable_DN68M-5ySj8UhPymSQ4U7A_iIjv65bR';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const $ = id => document.getElementById(id);
const authGate = $('authGate');
const adminApp = $('adminApp');
const loginForm = $('loginForm');
const loginEmail = $('loginEmail');
const loginPassword = $('loginPassword');
const loginError = $('loginError');
const logoutBtn = $('logoutBtn');

function showGate() {
  authGate.hidden = false;
  adminApp.hidden = true;
}

function showApp() {
  authGate.hidden = true;
  adminApp.hidden = false;
}

async function login(email, password) {
  const { error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = error.message;
  }
  return { error };
}

async function logout() {
  await sb.auth.signOut();
  showGate();
}

function onAuthReady(session) {
  if (session) {
    showApp();
  } else {
    showGate();
  }
}

loginForm.addEventListener('submit', e => {
  e.preventDefault();
  login(loginEmail.value, loginPassword.value);
});

logoutBtn.addEventListener('click', logout);

sb.auth.getSession().then(({ data }) => onAuthReady(data.session));
sb.auth.onAuthStateChange((_event, session) => onAuthReady(session));
