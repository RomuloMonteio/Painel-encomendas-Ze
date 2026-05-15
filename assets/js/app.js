/* ─── Sidebar toggle ─── */
(function () {
  const toggle  = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  if (!toggle || !sidebar) return;

  let overlay = document.querySelector('.overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'overlay';
    document.body.appendChild(overlay);
  }

  function openSidebar() {
    sidebar.classList.add('open');
    overlay.classList.add('show');
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay.classList.remove('show');
  }

  toggle.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  overlay.addEventListener('click', closeSidebar);
})();

/* ─── Toggle password visibility ─── */
document.querySelectorAll('[data-pw-toggle]').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = btn.closest('.input-group').querySelector('input');
    const icon  = btn.querySelector('i');
    if (!input) return;
    if (input.type === 'password') {
      input.type = 'text';
      icon.classList.replace('fa-eye', 'fa-eye-slash');
    } else {
      input.type = 'password';
      icon.classList.replace('fa-eye-slash', 'fa-eye');
    }
  });
});

/* ─── Qty stepper buttons ─── */
document.addEventListener('click', function (e) {
  const btn = e.target.closest('.qty-btn');
  if (!btn) return;
  const input = btn.closest('.qty-control').querySelector('.qty-input');
  if (!input) return;
  let val = parseInt(input.value, 10) || 0;
  if (btn.dataset.action === 'plus')  val = Math.max(0, val + 1);
  if (btn.dataset.action === 'minus') val = Math.max(0, val - 1);
  input.value = val;
  input.dispatchEvent(new Event('input', { bubbles: true }));
});

/* ─── Highlight filled qty inputs & live summary ─── */
(function () {
  const form = document.getElementById('formEncomenda');
  if (!form) return;

  const summaryEl = document.getElementById('orderSummaryCount');

  function refresh() {
    let total = 0;
    form.querySelectorAll('.qty-input').forEach(input => {
      const val = parseInt(input.value, 10) || 0;
      input.classList.toggle('has-value', val > 0);
      total += val;
    });
    if (summaryEl) summaryEl.textContent = total;
  }

  form.addEventListener('input', refresh);
  refresh();
})();

/* ─── Accordion categories ─── */
document.querySelectorAll('.categoria-header').forEach(header => {
  header.addEventListener('click', () => {
    const body    = header.nextElementSibling;
    const isOpen  = !header.classList.contains('collapsed');
    header.classList.toggle('collapsed', isOpen);
    if (isOpen) {
      body.style.maxHeight = '0';
      body.style.overflow  = 'hidden';
    } else {
      body.style.maxHeight = body.scrollHeight + 'px';
      body.style.overflow  = 'visible';
    }
  });
});

/* ─── Auto-dismiss alerts after 5s ─── */
setTimeout(() => {
  document.querySelectorAll('.alert-auto-dismiss').forEach(el => {
    el.style.transition = 'opacity .5s';
    el.style.opacity    = '0';
    setTimeout(() => el.remove(), 500);
  });
}, 5000);
