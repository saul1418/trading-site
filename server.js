const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { OAuth2Client } = require('google-auth-library');
const fs = require('fs-extra');
const path = require('path');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_PATH = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_PATH, 'users.json');
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = process.env.SMTP_PORT || 587;
const SMTP_SECURE = process.env.SMTP_SECURE === 'true';
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const EMAIL_FROM = process.env.EMAIL_FROM || 'no-reply@tradingpro.com';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const ADMIN_PASS = process.env.ADMIN_PASS || 'admin123';

const client = new OAuth2Client(GOOGLE_CLIENT_ID);

app.use(cors());
app.use(bodyParser.json());
// Basic protection: block direct requests to sensitive files and folders
app.use((req, res, next) => {
  const forbidden = ['/server.js', '/package.json', '/package-lock.json', '/.env', '/.git', '/data'];
  // If request targets a forbidden path or anything under /data, return 404
  if (forbidden.some(f => req.path === f || req.path.startsWith(f + '/') || req.path === '/data' || req.path.startsWith('/data/'))) {
    return res.status(404).end();
  }
  next();
});

// Domain routing middleware for root '/'
app.get('/', (req, res) => {
  const host = (req.headers.host || '').toLowerCase();
  
  // If domain is bigwinners.vip or winwinner.vip -> serve TAG Markets & IA Tech portal
  if (host.includes('bigwinners') || host.includes('winwinner')) {
    return res.sendFile(path.join(__dirname, 'tagmarkets_portal.html'));
  }
  
  // Default for tradingconproposito.lat or localhost -> serve Vantage Broker portal
  return res.sendFile(path.join(__dirname, 'index.html'));
});

// Serve static files from project root
app.use(express.static(__dirname));

let mailTransport;
let etherealAccount;

async function getMailTransport() {
  if (mailTransport) return mailTransport;
  if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
    mailTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_SECURE,
      auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    return mailTransport;
  }

  const testAccount = await nodemailer.createTestAccount();
  etherealAccount = testAccount;
  mailTransport = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
  return mailTransport;
}

async function sendVerificationEmail(email, code) {
  const transporter = await getMailTransport();
  const info = await transporter.sendMail({
    from: EMAIL_FROM,
    to: email,
    subject: 'Código de verificación para Trading Pro',
    text: `Tu código de verificación es: ${code}`,
    html: `<p>Tu código de verificación es:</p><h2>${code}</h2><p>Ingresa este código en la página de verificación para crear tu cuenta.</p>`
  });
  const previewUrl = !SMTP_HOST && etherealAccount ? nodemailer.getTestMessageUrl(info) : null;
  if (previewUrl) {
    console.log('Ethereal preview URL:', previewUrl);
  }
  return {
    previewUrl,
    testCode: !SMTP_HOST ? code : undefined
  };
}

async function readUsers() {
  await fs.ensureDir(DATA_PATH);
  if (!(await fs.pathExists(USERS_FILE))) {
    await fs.writeJson(USERS_FILE, []);
  }
  return fs.readJson(USERS_FILE);
}

async function writeUsers(users) {
  await fs.writeJson(USERS_FILE, users, { spaces: 2 });
}

function sanitizeUser(user) {
  if (!user) return null;
  const {
    passwordHash,
    verificationCode,
    verificationExpires,
    tempPasswordHash,
    tempPasswordCreatedAt,
    ...safeUser
  } = user;
  // Add safe derived/default fields for the client
  safeUser.balance = typeof safeUser.balance !== 'undefined' ? safeUser.balance : 0;
  safeUser.points = typeof safeUser.points !== 'undefined' ? safeUser.points : 0;
  safeUser.level = safeUser.level || 'Basic';
  safeUser.linkedAccounts = safeUser.linkedAccounts || [];
  // profileComplete: if provided use it, otherwise compute a simple completeness percent
  if (typeof safeUser.profileComplete === 'undefined') {
    let score = 0;
    if (safeUser.name) score += 30;
    if (safeUser.picture) score += 30;
    if (safeUser.verified) score += 20;
    if (safeUser.email) score += 20;
    safeUser.profileComplete = Math.min(100, score);
  }
  // Ensure progress object exists
  safeUser.progress = safeUser.progress || {};
  return safeUser;
}

app.post('/api/auth/google', async (req, res) => {
  const { id_token } = req.body;
  if (!id_token) return res.status(400).json({ error: 'Missing id_token' });

  try {
    const ticket = await client.verifyIdToken({ idToken: id_token, audience: GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    const users = await readUsers();
    let user = users.find(u => u.sub === payload.sub || u.email === payload.email);
    if (!user) {
      user = {
        id: Date.now().toString(36),
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
        provider: 'google',
        verified: true,
        progress: { diary: {}, createdAt: new Date().toISOString() },
        createdAt: new Date().toISOString()
      };
      users.push(user);
      await writeUsers(users);
    }

    const hasPassword = !!user.passwordHash;
    const token = jwt.sign({ id: user.id, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user: sanitizeUser(user), hasPassword });
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: 'Invalid token' });
  }
});

app.post('/api/request-verification', async (req, res) => {
  const { email, name, password } = req.body;
  if (!email || !password || !name) return res.status(400).json({ error: 'Missing email, name or password' });
  const normalizedEmail = email.toLowerCase();
  const users = await readUsers();
  const existing = users.find(u => u.email === normalizedEmail);
  if (existing && existing.verified) {
    return res.status(400).json({ error: 'Ya existe una cuenta verificada con ese correo' });
  }

  const code = crypto.randomInt(100000, 999999).toString();
  const expiresAt = Date.now() + 1000 * 60 * 15;
  const passwordHash = await bcrypt.hash(password, 10);

  if (existing) {
    existing.name = name;
    existing.passwordHash = passwordHash;
    existing.provider = 'local';
    existing.verified = false;
    existing.verificationCode = code;
    existing.verificationExpires = expiresAt;
  } else {
    users.push({
      id: Date.now().toString(36),
      email: normalizedEmail,
      name,
      passwordHash,
      provider: 'local',
      picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111827&color=ffffff&size=128`,
      verified: false,
      verificationCode: code,
      verificationExpires: expiresAt,
      progress: { diary: {}, createdAt: new Date().toISOString() },
      createdAt: new Date().toISOString()
    });
  }

  await writeUsers(users);
  try {
    const { previewUrl, testCode } = await sendVerificationEmail(normalizedEmail, code);
    res.json({ success: true, previewUrl, testCode });
  } catch (error) {
    console.error('Email send failed', error);
    res.status(500).json({ error: 'No se pudo enviar el correo de verificación' });
  }
});

app.post('/api/verify-code', async (req, res) => {
  const { email, code } = req.body;
  if (!email || !code) return res.status(400).json({ error: 'Missing email or code' });
  const normalizedEmail = email.toLowerCase();
  const users = await readUsers();
  const user = users.find(u => u.email === normalizedEmail);
  if (!user || !user.verificationCode) {
    return res.status(400).json({ error: 'No se encontró una verificación pendiente para este correo' });
  }
  if (user.verificationExpires < Date.now()) {
    return res.status(400).json({ error: 'El código ha expirado' });
  }
  if (user.verificationCode !== code) {
    return res.status(400).json({ error: 'Código de verificación incorrecto' });
  }

  user.verified = true;
  delete user.verificationCode;
  delete user.verificationExpires;
  await writeUsers(users);
  const token = jwt.sign({ id: user.id, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: sanitizeUser(user) });
});

// Register using Google ID token and a created password, or fallback to Gmail + password
app.post('/api/register', async (req, res) => {
  const { id_token, password, name, whatsapp, uid, email } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });

  let payload = null;
  if (id_token) {
    try {
      const ticket = await client.verifyIdToken({ idToken: id_token, audience: GOOGLE_CLIENT_ID });
      payload = ticket.getPayload();
      if (!payload || payload.email.toLowerCase() !== email.toLowerCase()) {
        return res.status(400).json({ error: 'El correo no coincide con el token de Google' });
      }
    } catch (e) {
      console.error(e);
      return res.status(400).json({ error: 'Token de Google inválido' });
    }
  } else {
    if (!email.toLowerCase().endsWith('@gmail.com')) {
      return res.status(400).json({ error: 'Regístrate con un correo Gmail válido o usa Google Sign-In' });
    }
  }

  const users = await readUsers();
  let user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (user && user.passwordHash) {
    return res.status(400).json({ error: 'Ya existe una cuenta con este correo' });
  }

  if (!user) {
    user = {
      id: Date.now().toString(36),
      email: email.toLowerCase(),
      name: name || (payload && payload.name) || '',
      picture: payload ? payload.picture : null,
      provider: id_token ? 'google' : 'local',
      createdAt: new Date().toISOString()
    };
    users.push(user);
  }

  const hash = await bcrypt.hash(password, 10);
  user.passwordHash = hash;
  if (whatsapp) user.whatsapp = whatsapp;
  if (uid) user.uid = uid;
  if (name) user.name = name;
  await writeUsers(users);

  const token = jwt.sign({ id: user.id, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: sanitizeUser(user) });
});

// Login with email + password
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Missing email or password' });
  const users = await readUsers();
  const user = users.find(u => u.email === email.toLowerCase());
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (!user.passwordHash) return res.status(400).json({ error: 'No password set for this account' });
  if (!user.verified) return res.status(403).json({ error: 'Correo no verificado' });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = jwt.sign({ id: user.id, role: user.role || 'user' }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: sanitizeUser(user) });
});

// Protected profile endpoint
app.get('/api/profile', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const users = await readUsers();
    const user = users.find(u => u.id === payload.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user: sanitizeUser(user) });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.get('/api/progress', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const users = await readUsers();
    const user = users.find(u => u.id === payload.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ progress: user.progress || {} });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

app.post('/api/progress', async (req, res) => {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.split(' ')[1];
  const { progress } = req.body;
  if (!progress) return res.status(400).json({ error: 'Missing progress data' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const users = await readUsers();
    const user = users.find(u => u.id === payload.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.progress = user.progress || {};
    user.progress.diary = progress.diary || user.progress.diary || {};
    user.progress.updatedAt = new Date().toISOString();
    await writeUsers(users);
    res.json({ success: true, progress: user.progress });
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
});

// Admin login - simple password to get admin JWT
app.post('/api/admin/login', async (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Missing password' });
  if (password !== ADMIN_PASS) return res.status(403).json({ error: 'Invalid admin password' });
  const token = jwt.sign({ role: 'admin' }, JWT_SECRET, { expiresIn: '1d' });
  res.json({ token });
});

function requireAdmin(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Unauthorized' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  } catch (e) {
    res.status(401).json({ error: 'Invalid token' });
  }
}

// Admin: list users
app.get('/api/admin/users', requireAdmin, async (req, res) => {
  const users = await readUsers();
  res.json({ users });
});

// Admin: set a temporary password (stored hashed) and return the plaintext to admin
app.post('/api/admin/users/:id/temp-password', requireAdmin, async (req, res) => {
  const { id } = req.params;
  const users = await readUsers();
  const user = users.find(u => u.id === id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const temp = crypto.randomBytes(4).toString('hex');
  const hash = await bcrypt.hash(temp, 10);
  user.passwordHash = hash;
  user.tempPasswordCreatedAt = new Date().toISOString();
  await writeUsers(users);
  res.json({ temp });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}. Visit http://localhost:${PORT}`);
});
