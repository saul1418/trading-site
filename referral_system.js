// System to handle personalized referral links (e.g., ?ref=ISMAEL or ?ref=SAUL)
(function() {
    function initReferralSystem() {
        const urlParams = new URLSearchParams(window.location.search);
        let refCode = urlParams.get('ref') || urlParams.get('sponsor') || urlParams.get('r') || urlParams.get('referral');
        
        if (refCode) {
            localStorage.setItem('tcp_referral_code', refCode);
        } else {
            refCode = localStorage.getItem('tcp_referral_code') || '';
        }

        if (!refCode) return;

        // Display Referral Sponsor Badge if present
        displayReferralBadge(refCode);

        // Update all internal and external links
        updatePageLinks(refCode);
    }

    function displayReferralBadge(code) {
        const header = document.querySelector('header');
        if (!header || document.getElementById('referral-sponsor-badge')) return;

        const badge = document.createElement('div');
        badge.id = 'referral-sponsor-badge';
        badge.className = 'bg-cyan-600/10 dark:bg-cyan-400/10 text-cyan-700 dark:text-cyan-300 text-xs font-black px-3 py-1 rounded-full border border-cyan-500/30 flex items-center gap-1.5 shrink-0 ml-auto mr-3';
        badge.innerHTML = `<i class="ph-fill ph-user-check text-sm"></i> <span>Referido por: <strong>${escapeHtml(code.toUpperCase())}</strong></span>`;
        
        const rightContainer = header.querySelector('.flex.items-center.gap-3') || header.querySelector('.flex.items-center');
        if (rightContainer) {
            rightContainer.insertBefore(badge, rightContainer.firstChild);
        }
    }

    function updatePageLinks(code) {
        const links = document.querySelectorAll('a[href]');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;

            // Internal page links (.html)
            if (href.endsWith('.html') || href.includes('.html?')) {
                try {
                    const url = new URL(href, window.location.origin);
                    url.searchParams.set('ref', code);
                    link.setAttribute('href', url.pathname + url.search);
                } catch(e) {}
            }
        });
    }

    function escapeHtml(str) {
        return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initReferralSystem);
    } else {
        initReferralSystem();
    }
})();
