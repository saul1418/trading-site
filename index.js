document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('mobile-nav-toggle');
  const nav = document.getElementById('main-nav');
  if (!toggle || !nav) return;

  function toggleMenu(e) {
    if (e) e.stopPropagation();
    const isOpen = nav.classList.contains('open') || nav.classList.contains('active');
    if (isOpen) {
      nav.classList.remove('open', 'active');
      toggle.classList.remove('open', 'active');
      document.body.style.overflow = '';
    } else {
      nav.classList.add('open', 'active');
      toggle.classList.add('open', 'active');
      document.body.style.overflow = 'hidden';
    }
  }

  toggle.addEventListener('click', toggleMenu);

  // Close menu when clicking any link inside nav
  nav.querySelectorAll('a').forEach(function(link) {
    link.addEventListener('click', function() {
      nav.classList.remove('open', 'active');
      toggle.classList.remove('open', 'active');
      document.body.style.overflow = '';
    });
  });

  // Close menu when clicking outside
  document.addEventListener('click', function(e) {
    if (nav.classList.contains('open') || nav.classList.contains('active')) {
      if (!nav.contains(e.target) && !toggle.contains(e.target)) {
        nav.classList.remove('open', 'active');
        toggle.classList.remove('open', 'active');
        document.body.style.overflow = '';
      }
    }
  });
});

