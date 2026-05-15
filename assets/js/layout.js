import { auth, db }           from './firebase.js';
import { onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { doc, getDoc }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

// ─── Sidebar HTML ─────────────────────────────────────────────────────────
function buildSidebar(paginaAtual, userName, userNivel) {
  const sections = [
    {
      label: 'Principal',
      links: [
        { id: 'dashboard', href: 'dashboard.html', icon: 'fa-chart-pie',         label: 'Dashboard' },
      ],
    },
    // { // Nova Encomenda — oculto temporariamente
    //   label: 'Nova Encomenda',
    //   links: [
    //     { id: 'super-bock', href: 'encomendas.html?marca=super-bock', icon: 'fa-beer-mug-empty', label: 'Super Bock', badge: 'SB' },
    //     { id: 'sumol',      href: 'encomendas.html?marca=sumol',       icon: 'fa-bottle-water',  label: 'Sumol',      badge: 'SM' },
    //   ],
    // },
    {
      label: 'Contagem de Stock',
      links: [
        { id: 'contagem-super-bock', href: 'contagem.html?marca=super-bock', icon: 'fa-clipboard-list', label: 'Super Bock', badge: 'SB' },
        { id: 'contagem-sumol',      href: 'contagem.html?marca=sumol',       icon: 'fa-clipboard-list', label: 'Sumol',      badge: 'SM' },
        { id: 'contagem-cozinha',    href: 'contagem.html?marca=cozinha',     icon: 'fa-utensils',       label: 'Cozinha',    badge: 'CZ' },
      ],
    },
    {
      label: 'Registos',
      links: [
        // { id: 'historico', href: 'historico.html', icon: 'fa-clock-rotate-left', label: 'Encomendas' }, // oculto temporariamente
        { id: 'historico-contagens', href: 'historico-contagens.html', icon: 'fa-clipboard-check', label: 'Contagens' },
      ],
    },
  ];

  const navHTML = sections.map(sec => `
    <div class="sidebar-section-label">${sec.label}</div>
    ${sec.links.map(l => `
      <a href="${l.href}" class="sidebar-link ${l.id === paginaAtual ? 'active' : ''}">
        <i class="fas ${l.icon}"></i>
        <span>${l.label}</span>
        ${l.badge ? `<span class="sidebar-badge">${l.badge}</span>` : ''}
      </a>`).join('')}`).join('<div class="mt-3"></div>');

  const ini   = userName ? userName.charAt(0).toUpperCase() : 'U';
  const papel = userNivel === 'admin' ? 'Administrador' : 'Funcionário';

  return `
    <div class="sidebar-brand">
      <div class="sidebar-brand-icon"><i class="fas fa-box-open"></i></div>
      <div class="sidebar-brand-text">
        <span class="sidebar-brand-title">Encomendas</span>
        <span class="sidebar-brand-sub">Gestão</span>
      </div>
    </div>
    <nav class="sidebar-nav">${navHTML}</nav>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-avatar">${ini}</div>
        <div class="sidebar-user-info">
          <span class="sidebar-user-name">${userName ?? ''}</span>
          <span class="sidebar-user-role">${papel}</span>
        </div>
      </div>
      <button class="sidebar-logout-btn" id="btnLogout" title="Sair">
        <i class="fas fa-right-from-bracket"></i>
      </button>
    </div>`;
}

// ─── Topbar HTML ──────────────────────────────────────────────────────────
function buildTopbar(titulo) {
  const hoje = new Date().toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return `
    <div class="topbar-left">
      <button class="sidebar-toggle" id="sidebarToggle" aria-label="Menu">
        <i class="fas fa-bars"></i>
      </button>
      <span class="topbar-title">${titulo}</span>
    </div>
    <div class="topbar-right">
      <span class="topbar-date"><i class="far fa-calendar-days me-1"></i>${hoje}</span>
      <button class="topbar-logout-btn" id="topbarLogout" title="Sair">
        <i class="fas fa-right-from-bracket"></i>
      </button>
    </div>`;
}

// ─── Sidebar toggle (mobile) ──────────────────────────────────────────────
function setupToggle() {
  const sidebar = document.getElementById('sidebar');
  const toggle  = document.getElementById('sidebarToggle');
  if (!toggle || !sidebar) return;

  let overlay = document.querySelector('.overlay');
  if (!overlay) {
    overlay = Object.assign(document.createElement('div'), { className: 'overlay' });
    document.body.appendChild(overlay);
  }

  const open  = () => { sidebar.classList.add('open');    overlay.classList.add('show');  };
  const close = () => { sidebar.classList.remove('open'); overlay.classList.remove('show'); };

  toggle.addEventListener('click', () => sidebar.classList.contains('open') ? close() : open());
  overlay.addEventListener('click', close);
}

// ─── Logout ───────────────────────────────────────────────────────────────
function setupLogout() {
  document.querySelectorAll('#btnLogout, #topbarLogout').forEach(btn =>
    btn.addEventListener('click', () =>
      signOut(auth).then(() => { window.location.href = 'index.html'; })
    )
  );
}

// ─── initPage — ponto de entrada de cada página ───────────────────────────
export function initPage({ pagina, titulo, onReady }) {
  onAuthStateChanged(auth, async user => {
    if (!user) { window.location.href = 'index.html'; return; }

    let userData = { nome: user.email, nivel: 'funcionario' };
    try {
      const snap = await getDoc(doc(db, 'users', user.uid));
      if (snap.exists()) userData = snap.data();
    } catch (_) {}

    document.getElementById('sidebar').innerHTML = buildSidebar(pagina, userData.nome, userData.nivel);
    document.getElementById('topbar').innerHTML  = buildTopbar(titulo);

    setupToggle();
    setupLogout();

    if (onReady) onReady(user, userData);
  });
}
