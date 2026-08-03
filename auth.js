const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID';
let isLoginMode = false;
let pendingVerification = null;

function initGoogleAuth() {
    const button = document.getElementById('g-signin-button');
    if (!button) return;
    button.style.display = 'none';
}

function showMessage(message, type = 'info') {
    const messageEl = document.getElementById('auth-message');
    if (!messageEl) return;
    messageEl.innerHTML = message || '';
    messageEl.style.display = message ? 'block' : 'none';
    if (type === 'error') {
        messageEl.style.background = '#fee2e2';
        messageEl.style.color = '#991b1b';
        messageEl.style.border = '1px solid #fca5a5';
    } else {
        messageEl.style.background = '#f7fee7';
        messageEl.style.color = '#365314';
        messageEl.style.border = '1px solid #d9f99d';
    }
}

async function resendVerificationCode() {
    const stored = pendingVerification || getPendingVerification();
    if (!stored || !stored.email) {
        showMessage('No hay un registro pendiente para reenviar.', 'error');
        return;
    }

    const { status, json } = await sendVerificationRequest(stored.email, stored.name, stored.password);
    console.debug('resendVerificationCode response', { status, json });
    if (status === 200) {
        let message = 'Código reenviado. Revisa tu correo.';
        if (json?.previewUrl) {
            message += ` <a href="${json.previewUrl}" target="_blank" rel="noopener noreferrer" style="color:#7dd3fc; text-decoration:underline;">Ver vista previa</a>`;
        }
        if (json?.testCode) {
            message += ` Código de prueba: <strong>${json.testCode}</strong>`;
        }
        showMessage(message);
        return;
    }
    showMessage(json?.error || 'No se pudo reenviar el código.', 'error');
}

function getPendingVerification() {
    try {
        return JSON.parse(localStorage.getItem('pending_verification') || 'null');
    } catch (e) {
        return null;
    }
}

function setPendingVerification(data) {
    localStorage.setItem('pending_verification', JSON.stringify(data));
}

function clearPendingVerification() {
    localStorage.removeItem('pending_verification');
}

function getStoredAccounts() {
    try {
        return JSON.parse(localStorage.getItem('trading_accounts') || '{}');
    } catch (e) {
        return {};
    }
}

function saveStoredAccounts(accounts) {
    localStorage.setItem('trading_accounts', JSON.stringify(accounts));
}

function createLocalToken(email) {
    return btoa(`${email}:${Date.now()}`);
}

function registerLocalAccount(email, name, password) {
    const accounts = getStoredAccounts();
    if (accounts[email]) {
        return { status: 400, json: { error: 'Ya existe una cuenta con ese correo.' } };
    }
    accounts[email] = { email, name, password, picture: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=111827&color=ffffff&size=128` };
    saveStoredAccounts(accounts);
    return { status: 200, json: { token: createLocalToken(email), user: accounts[email] } };
}

function loginLocalAccount(email, password) {
    const accounts = getStoredAccounts();
    const existing = accounts[email];
    if (!existing) {
        return { status: 401, json: { error: 'El correo no está registrado.' } };
    }
    if (existing.password !== password) {
        return { status: 401, json: { error: 'Contraseña incorrecta.' } };
    }
    return { status: 200, json: { token: createLocalToken(email), user: existing } };
}

async function sendVerificationRequest(email, name, password) {
    try {
        const res = await fetch('/api/request-verification', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, name, password })
        });
        const json = await res.json();
        console.debug('sendVerificationRequest response', { status: res.status, json });
        if (res.ok) {
            const verificationState = { email, name, password };
            pendingVerification = verificationState;
            setPendingVerification(verificationState);
            let message = 'Hemos enviado un código de verificación a tu correo.';
            if (json?.previewUrl) {
                message += ` <a href="${json.previewUrl}" target="_blank" rel="noopener noreferrer" style="color:#7dd3fc; text-decoration:underline;">Ver vista previa</a>`;
            }
            if (json?.testCode) {
                message += ` Código de prueba: <strong>${json.testCode}</strong>`;
            }
            setVerificationState(email, message);
            return { status: res.status, json };
        }
        return { status: res.status, json };
    } catch (err) {
        console.error('sendVerificationRequest error', err);
        return { status: 0, json: { error: 'No se pudo conectar con el servidor.' } };
    }
}

async function verifyCode(email, code) {
    try {
        const res = await fetch('/api/verify-code', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, code })
        });
        const json = await res.json();
        return { status: res.status, json };
    } catch (err) {
        return { status: 0, json: { error: 'No se pudo conectar con el servidor.' } };
    }
}

async function loginAccount(email, password) {
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const json = await res.json();
        return { status: res.status, json };
    } catch (err) {
        return loginLocalAccount(email, password);
    }
}

function getRegisterMarkup() {
    return `
        <div class="form-group">
            <label for="auth-email">Correo electrónico</label>
            <input type="email" id="auth-email" name="email" required placeholder="tu@gmail.com">
        </div>
        <div class="form-group">
            <label for="auth-name">Nombre completo</label>
            <input type="text" id="auth-name" name="name" required placeholder="Tu nombre completo">
        </div>
        <div class="form-group">
            <label for="auth-password">Contraseña</label>
            <input type="password" id="auth-password" name="password" required placeholder="Crea una contraseña segura">
        </div>
        <button id="auth-submit" class="btn btn-primary btn-full" type="submit">Crear cuenta</button>
    `;
}

function getLoginMarkup() {
    return `
        <div class="form-group">
            <label for="login-email">Correo electrónico</label>
            <input type="email" id="login-email" name="email" required placeholder="tu@gmail.com">
        </div>
        <div class="form-group">
            <label for="login-password">Contraseña</label>
            <input type="password" id="login-password" name="password" required placeholder="Tu contraseña">
        </div>
        <button id="auth-submit" class="btn btn-primary btn-full" type="submit">Iniciar sesión</button>
    `;
}

function getVerificationMarkup(email) {
    return `
        <div class="form-group">
            <label for="verify-email">Correo a verificar</label>
            <input type="email" id="verify-email" name="email" value="${email}" readonly>
        </div>
        <div class="form-group">
            <label for="verify-code">Código de verificación</label>
            <input type="text" id="verify-code" name="code" required placeholder="Ingresa el código recibido">
        </div>
        <button id="auth-submit" class="btn btn-primary btn-full" type="submit">Verificar cuenta</button>
        <button id="resend-code" type="button" class="btn btn-secondary btn-full" style="margin-top: 12px;">Reenviar código</button>
    `;
}

function setFormMode(loginMode) {
    const form = document.getElementById('auth-form');
    const toggle = document.getElementById('auth-login-toggle');
    const title = document.querySelector('.auth-card h1');
    const paragraph = document.querySelector('.auth-card p');
    const notice = document.getElementById('google-notice');

    isLoginMode = loginMode;
    if (!form || !toggle || !title || !paragraph) return;

    if (loginMode) {
        title.textContent = 'Iniciar sesión';
        paragraph.textContent = 'Ingresa con tu correo y contraseña para acceder a tu tablero de trading.';
        if (notice) notice.textContent = 'Si te registraste antes, inicia sesión con tu correo y contraseña.';
        form.innerHTML = getLoginMarkup();
        form.dataset.formState = 'login';
        toggle.textContent = '¿No tienes cuenta? Regístrate';
    } else {
        title.textContent = 'Bienvenido';
        paragraph.textContent = 'Regístrate con tu correo y contraseña para crear tu cuenta y recibir un código de verificación.';
        if (notice) notice.textContent = 'El código llegará a tu correo y activará tu cuenta para iniciar sesión.';
        form.innerHTML = getRegisterMarkup();
        form.dataset.formState = 'register';
        toggle.textContent = '¿Ya tienes cuenta? Inicia sesión aquí';
    }
    showMessage('');
    attachSubmitHandler();
}

function setVerificationState(email, message = 'Revisa tu bandeja de entrada y pega el código aquí.') {
    const form = document.getElementById('auth-form');
    const title = document.querySelector('.auth-card h1');
    const paragraph = document.querySelector('.auth-card p');
    const toggle = document.getElementById('auth-login-toggle');

    if (!form || !title || !paragraph || !toggle) return;
    form.innerHTML = getVerificationMarkup(email);
    form.dataset.formState = 'verify';
    title.textContent = 'Verifica tu cuenta';
    paragraph.textContent = 'Hemos enviado un código al correo indicado. Ingresa el código para activar tu cuenta.';
    toggle.textContent = '¿Ya tienes cuenta? Inicia sesión aquí';
    showMessage(message);
    attachSubmitHandler();
    const resendButton = document.getElementById('resend-code');
    if (resendButton) {
        resendButton.addEventListener('click', resendVerificationCode);
    }
}

function saveUserProfile(user) {
    if (!user || !user.email) return;
    const existing = JSON.parse(localStorage.getItem('app_user') || 'null');
    const profile = {
        name: user.name || existing?.name || user.email.split('@')[0],
        email: user.email,
        picture: user.picture || existing?.picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name || user.email.split('@')[0])}&background=111827&color=ffffff&size=128`,
        createdAt: existing?.createdAt || user.createdAt || new Date().toISOString()
    };
    localStorage.setItem('app_user', JSON.stringify(profile));
}

function attachSubmitHandler() {
    const form = document.getElementById('auth-form');
    if (!form) return;
    form.onsubmit = async (e) => {
        e.preventDefault();
        const formState = form.dataset.formState;

        if (formState === 'login') {
            const email = document.getElementById('login-email').value.trim().toLowerCase();
            const password = document.getElementById('login-password').value;
            const { status, json } = await loginAccount(email, password);
            if (status === 200 && json.token) {
                localStorage.setItem('app_token', json.token);
                saveUserProfile({ email, name: json.user?.name || email, picture: json.user?.picture });
                window.location.href = 'trading_dashboard_pro.html';
                return;
            }
            showMessage(json?.error || 'Error al iniciar sesión', 'error');
            return;
        }

        if (formState === 'verify') {
            const email = document.getElementById('verify-email').value.trim().toLowerCase();
            const code = document.getElementById('verify-code').value.trim();
            if (!code) {
                showMessage('Ingresa el código de verificación.', 'error');
                return;
            }
            const { status, json } = await verifyCode(email, code);
            if (status === 200 && json.token) {
                localStorage.setItem('app_token', json.token);
                saveUserProfile({ email: json.user.email, name: json.user.name, picture: json.user.picture, createdAt: json.user.createdAt });
                clearPendingVerification();
                window.location.href = 'trading_dashboard_pro.html';
                return;
            }
            showMessage(json?.error || 'Error al verificar el código', 'error');
            return;
        }

        const email = document.getElementById('auth-email').value.trim().toLowerCase();
        const name = document.getElementById('auth-name').value.trim();
        const password = document.getElementById('auth-password').value;
        if (!email || !name || !password) {
            showMessage('Completa todos los campos para registrarte.', 'error');
            return;
        }

        const result = await sendVerificationRequest(email, name, password);
        if (result.status === 200) {
            return;
        }
        if (result.status === 0) {
            showMessage('No se pudo conectar con el servidor backend. Asegúrate de que el servidor esté activo.', 'error');
            return;
        }
        showMessage(result.json?.error || 'Error al registrar la cuenta', 'error');
    };
}

function getQueryMode() {
    const params = new URLSearchParams(window.location.search);
    const mode = params.get('mode');
    return mode === 'login' ? 'login' : 'register';
}

function setupDynamicPortalBackLinks() {
    const params = new URLSearchParams(window.location.search);
    const fromParam = params.get('from') || '';
    const ref = document.referrer || '';

    const backLink = document.getElementById('auth-back-link');
    const backText = document.getElementById('auth-back-text');
    const logoLink = document.getElementById('auth-logo-link');

    if (fromParam === 'tagmarkets' || ref.includes('tagmarkets') || ref.includes('socialtrading')) {
        if (backLink) backLink.href = 'tagmarkets_portal.html';
        if (backText) backText.textContent = 'Volver al Portal TAG Markets';
        if (logoLink) logoLink.href = 'tagmarkets_portal.html';
    } else if (fromParam === 'vantage' || ref.includes('vantage') || ref.includes('index.html')) {
        if (backLink) backLink.href = 'index.html';
        if (backText) backText.textContent = 'Volver al Portal Vantage';
        if (logoLink) logoLink.href = 'index.html';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initGoogleAuth();
    setupDynamicPortalBackLinks();
    document.getElementById('auth-login-toggle').addEventListener('click', (e) => {
        e.preventDefault();
        setFormMode(!isLoginMode);
    });

    const storedVerification = getPendingVerification();
    if (storedVerification && storedVerification.email) {
        pendingVerification = storedVerification;
        setVerificationState(storedVerification.email);
        return;
    }

    const mode = getQueryMode();
    setFormMode(mode === 'login');
});
