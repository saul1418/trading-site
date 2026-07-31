// Bonus Calculator Functionality
function setDeposit(amount) {
    const depositInput = document.getElementById('deposit');
    depositInput.value = amount;
    updateCalculator();
}

function updateCalculator() {
    const depositInput = document.getElementById('deposit');
    const deposit = parseFloat(depositInput.value) || 0;
    const bonus = deposit * 1.5;
    const total = deposit + bonus;

    document.getElementById('deposit-display').textContent = `$${deposit.toLocaleString()} USD`;
    document.getElementById('bonus-display').textContent = `+$${bonus.toLocaleString()} USD`;
    document.getElementById('total-display').textContent = `$${total.toLocaleString()} USD`;
}

// Initialize calculator
document.addEventListener('DOMContentLoaded', function() {
    const depositInput = document.getElementById('deposit');
    if (depositInput) {
        depositInput.addEventListener('input', updateCalculator);
        updateCalculator();
    }

    // FAQ Accordion
    const faqQuestions = document.querySelectorAll('.faq-question');
    faqQuestions.forEach(question => {
        question.addEventListener('click', function() {
            const faqItem = this.parentElement;
            const isActive = faqItem.classList.contains('active');
            
            // Close all FAQ items
            document.querySelectorAll('.faq-item').forEach(item => {
                item.classList.remove('active');
            });

            // Open clicked item if it wasn't active
            if (!isActive) {
                faqItem.classList.add('active');
            }
        });
    });

    // Form Submission
    const form = document.getElementById('registration-form');
    if (form) {
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            
            // Get form data
            const formData = {
                name: document.getElementById('name').value,
                email: document.getElementById('email').value,
                whatsapp: document.getElementById('whatsapp').value,
                uid: document.getElementById('uid').value
            };

            // Validate form
            if (!formData.name || !formData.email || !formData.whatsapp || !formData.uid) {
                alert('Por favor completa todos los campos');
                return;
            }

            // Require Google verification token and password to create account
            const googleTokenEl = document.getElementById('google-id-token');
            const passwordEl = document.getElementById('password');
            const idToken = googleTokenEl ? googleTokenEl.value : '';
            const password = passwordEl ? passwordEl.value : '';

            if (!idToken) {
                alert('Por favor regístrate usando tu cuenta de Google antes de crear una contraseña.');
                return;
            }

            if (!password) {
                alert('Por favor crea una contraseña para tu cuenta.');
                return;
            }

            // Send registration request to server
            fetch('/api/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_token: idToken, password: password, name: formData.name, whatsapp: formData.whatsapp, uid: formData.uid })
            }).then(r => r.json()).then(data => {
                if (data && data.token) {
                    localStorage.setItem('app_token', data.token);
                    form.style.display = 'none';
                    document.getElementById('form-success').style.display = 'block';
                    showProfile(data.user);
                } else {
                    console.error('Registration failed', data);
                    alert('Registro falló. Revisa la consola para más detalles.');
                }
            }).catch(err => {
                console.error(err);
                alert('Error en el registro');
            });
        });
    }

    // Smooth scroll for anchor links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });

    // Header scroll effect
    const header = document.querySelector('.header');
    window.addEventListener('scroll', function() {
        if (window.scrollY > 50) {
            header.style.boxShadow = '0 4px 20px rgba(0, 0, 0, 0.3)';
        } else {
            header.style.boxShadow = 'none';
        }
    });

    // Animate elements on scroll
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    // Observe all cards and sections
    document.querySelectorAll('.benefit-card, .step-card, .faq-item, .hero-card, .partnership-card').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
});

// --- Google Sign-In integration ---
function initGoogleSignIn() {
    const clientId = window.GOOGLE_CLIENT_ID || 'YOUR_GOOGLE_CLIENT_ID';
    if (!clientId) return;
    if (!window.google || !google.accounts || !google.accounts.id) return;

    google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse
    });

    google.accounts.id.renderButton(
        document.getElementById('g-signin-button'),
        { theme: 'outline', size: 'large', width: '270' }
    );
}

function handleCredentialResponse(response) {
    // response.credential is the ID token
    const idToken = response.credential;
    if (!idToken) return;
    // Prefill form fields from token (not trusted until server verifies)
    const payload = parseJwt(idToken);
    if (payload) {
        const nameEl = document.getElementById('name');
        const emailEl = document.getElementById('email');
        if (nameEl && payload.name) nameEl.value = payload.name;
        if (emailEl && payload.email) {
            emailEl.value = payload.email;
            emailEl.readOnly = true;
        }
        const gid = document.getElementById('google-id-token');
        if (gid) gid.value = idToken;
        const pwdGroup = document.getElementById('password-group');
        if (pwdGroup) pwdGroup.style.display = 'block';
    }

    // Ask server whether this Google account already has a password (i.e., account created)
    fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id_token: idToken })
    }).then(r => r.json()).then(data => {
        if (data && data.token) {
            // User exists and has password -> login
            localStorage.setItem('app_token', data.token);
            showProfile(data.user);
        } else if (data && data.user && data.hasPassword === false) {
            // User verified but needs to create password; UI shows password field
            console.log('Cuenta verificada. Crea una contraseña para completar el registro.');
        } else {
            console.error('Auth check failed', data);
        }
    }).catch(err => console.error(err));
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

function showProfile(user) {
    if (!user) return;
    const profile = document.getElementById('profile');
    const pic = document.getElementById('profile-pic');
    const name = document.getElementById('profile-name');
    pic.src = user.picture || '';
    name.textContent = user.name || user.email || '';
    profile.style.display = 'inline-flex';
    const btn = document.getElementById('signout-btn');
    btn.addEventListener('click', signOut);
}

function signOut() {
    // Remove local token and notify Google
    localStorage.removeItem('app_token');
    if (window.google && google.accounts && google.accounts.id) {
        google.accounts.id.disableAutoSelect();
    }
    const profile = document.getElementById('profile');
    if (profile) profile.style.display = 'none';
}

// Try to initialize Google after load
window.addEventListener('load', function() {
    try {
        initGoogleSignIn();
    } catch (e) {
        console.warn('Google Sign-In init failed', e);
    }
});

// If user already has token, try to fetch profile (optional)
async function fetchLocalProfile() {
    const token = localStorage.getItem('app_token');
    if (!token) return;
    try {
        const res = await fetch('/api/profile', { headers: { 'Authorization': 'Bearer ' + token } });
        if (res.ok) {
            const json = await res.json();
            showProfile(json.user);
        }
    } catch (e) {
        console.warn('Could not fetch profile', e);
    }
}

fetchLocalProfile();
