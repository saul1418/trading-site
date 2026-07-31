document.addEventListener('DOMContentLoaded', function() {
  const toggle = document.getElementById('mobile-nav-toggle');
  const nav = document.getElementById('main-nav');
  if (!toggle || !nav) return;
  toggle.addEventListener('click', function() {
    nav.classList.toggle('open');
  });
});
