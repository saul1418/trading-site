const messages = [
    'Hoy es un buen día para aprender algo nuevo de trading.',
    'Recuerda: gestiona tu riesgo antes de buscar ganancias.',
    'La consistencia vence a la emoción en el trading.',
    'Estudia el mercado, no lo adivines. La disciplina es tu mejor aliada.',
    'Siéntate con tu plan y no operes por FOMO.'
];

const signals = [
    { title: 'Señal del día', text: 'Observa el par EUR/USD. Espera una confirmación en 1H antes de entrar.' },
    { title: 'Consejo', text: 'Utiliza stops ajustados y no arriesgues más del 2% de tu cuenta por operación.' },
    { title: 'Motivación', text: 'Cada operación es una lección; registra tus resultados y aprende de ellos.' }
];

function renderDashboard(user) {
    const welcome = document.getElementById('dashboard-welcome');
    welcome.innerHTML = `<h2>Hola, ${user.name || user.email}</h2><p>Tu última sesión fue con este correo: ${user.email}</p>`;
    const cards = document.getElementById('dashboard-cards');
    cards.innerHTML = '';
    messages.slice(0, 2).forEach(text => {
        const card = document.createElement('div');
        card.className = 'benefit-card';
        card.innerHTML = `<h3 class="benefit-title">Mensaje</h3><p class="benefit-description">${text}</p>`;
        cards.appendChild(card);
    });
    signals.forEach(signal => {
        const card = document.createElement('div');
        card.className = 'benefit-card';
        card.innerHTML = `<h3 class="benefit-title">${signal.title}</h3><p class="benefit-description">${signal.text}</p>`;
        cards.appendChild(card);
    });
}

async function loadDashboard() {
    const token = localStorage.getItem('app_token');
    if (!token) {
        window.location.href = 'auth.html';
        return;
    }
    const res = await fetch('/api/profile', { headers: { 'Authorization': 'Bearer ' + token }});
    if (!res.ok) {
        localStorage.removeItem('app_token');
        window.location.href = 'auth.html';
        return;
    }
    const data = await res.json();
    renderDashboard(data.user);
}

document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    document.getElementById('logout-btn').addEventListener('click', () => {
        localStorage.removeItem('app_token');
        window.location.href = 'index.html';
    });
});
