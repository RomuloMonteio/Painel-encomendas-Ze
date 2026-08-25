# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

HTML5 · CSS3 · JavaScript (ES Modules) · Firebase 10 (Auth + Firestore) · Bootstrap 5.3 · jsPDF 2.5 + autoTable

Sem servidor, sem PHP, sem build step — servir os ficheiros estáticos diretamente.

## Configuração inicial

1. Criar projeto Firebase em [console.firebase.google.com](https://console.firebase.google.com), no plano **Blaze** (necessário para Cloud Functions)
2. Activar **Authentication → Email/Password**
3. Criar base de dados **Firestore** em modo produção
4. Preencher `assets/js/firebase.js` com as credenciais do projeto
5. Publicar `firestore.rules` e as Cloud Functions (`firebase deploy --only firestore:rules,functions`)
6. **Primeiro administrador** (ovo-e-galinha — só pode ser feito manualmente): criar a conta em **Authentication → Users** no Firebase Console e criar o documento `users/{uid}` com `{ nome: "Nome", nivel: "admin" }`. A partir daí, todos os outros utilizadores (admins ou funcionários) são geridos em `utilizadores.html` por um admin já existente.
7. Servir com qualquer servidor estático (ex.: `npx serve .` ou extensão Live Server do VS Code)

> Os ES Modules requerem que os ficheiros sejam servidos via HTTP(S), não via `file://`.

## Estrutura de pastas

```
index.html           login
dashboard.html       dashboard principal (stats, gráfico, calendário de listas)
encomendas.html      formulário de encomenda (?marca=super-bock|sumol)
historico.html       histórico com filtros client-side e paginação
utilizadores.html    painel de administração de utilizadores (só nivel:'admin')
firestore.rules      regras de segurança do Firestore
firebase.json         config Firestore + Cloud Functions

functions/            Cloud Functions (Admin SDK) — gestão de contas de utilizador
  index.js             adminCriarUtilizador, adminAtualizarUtilizador, adminApagarUtilizador, adminListarUtilizadores

assets/
  css/style.css        design completo (variáveis CSS, layout, formulário, tabela)
  js/
    firebase.js        initializeApp + export auth, db, functions
    admin-api.js       wrappers httpsCallable para as Cloud Functions de administração
    contagem-modal.js  modal de detalhe de contagem partilhado (histórico + calendário)
    data.js            dados estáticos: MARCAS, CATEGORIAS, PRODUTOS_MAP, AGENDA_SEMANAL
    layout.js          initPage() — auth guard, sidebar/topbar injection, logout
    pdf.js             gerarPDF(encomenda) via jsPDF + autoTable
    pages/
      dashboard.js     stats Firestore, gráfico Chart.js, tabela últimas, calendário de listas
      encomendas.js    buildForm(), submit → Firestore, geração de número atómico
      historico.js     load 200 encomendas, filtros client-side, paginação, updateDoc estado
      utilizadores.js  CRUD de utilizadores via admin-api.js (só acessível a admins)
```

## Arquitectura

**Auth guard:** `initPage({ pagina, titulo, onReady })` em `layout.js` escuta `onAuthStateChanged`. Se sem sessão → redireciona para `index.html`. Quando autenticado, carrega o perfil do utilizador de `users/{uid}` e chama `onReady(user, userData)`.

**Fluxo de encomenda:**
`encomendas.html?marca=X` → `encomendas.js` lê produtos de `data.js` → constrói form dinâmico → submit cria `runTransaction` para número atómico → `addDoc` em `encomendas/` → mostra painel de sucesso com botão PDF.

**Número de encomenda:**
Transação Firestore em `meta/counter` com chave `total_{ano}` — garante sequência sem race conditions.

**PDF:**
`gerarPDF(encomenda)` em `pdf.js` usa `window.jspdf.jsPDF` (carregado como script UMD antes do módulo). Agrupa itens por campo `categoria` armazenado em cada item da encomenda.

**Filtros do histórico:**
Client-side sobre até 200 documentos carregados de uma vez. Adequado para volume de um restaurante. Paginação também client-side (20 por página). Aceita `?userId=&userNome=` na query string (vindo do painel de utilizadores) para filtrar implicitamente as contagens de uma pessoa, mostrando um badge "Filtrado por: X".

**Painel de administração (`utilizadores.html`):**
O SDK do Firebase no browser não permite que um utilizador crie, apague ou altere a password de outro — só o Admin SDK, que corre num backend, consegue isso. Por isso a gestão de contas passa por `functions/index.js` (Cloud Functions `onCall`), chamadas do cliente via `assets/js/admin-api.js` (`httpsCallable`). Todas as functions verificam no servidor que quem chama tem `nivel:'admin'` no Firestore antes de agir — a verificação client-side em `utilizadores.js` é só UX, não segurança. As Firestore rules também permitem que um admin leia/atualize qualquer `users/{uid}` (função `isAdmin()` em `firestore.rules`), mas a criação e remoção de contas continuam bloqueadas ao cliente — só passam pelas Cloud Functions.

## Colecção Firestore `encomendas`

```
{
  numero:          "ENC-2026-0001",
  userId:          "uid",
  userNome:        "Nome do utilizador",
  marcaSlug:       "super-bock" | "sumol",
  marcaNome:       "Super Bock",
  marcaCor:        "#003087",
  estado:          "enviada" | "confirmada" | "entregue" | "cancelada",
  observacoes:     "",
  itens: [{ produtoId, nome, referencia, unidade, categoria, quantidade }],
  totalQuantidade: 12,
  createdAt:       Timestamp,
}
```

## Adicionar produtos ou marcas

Editar apenas `assets/js/data.js` — as estruturas `MARCAS`, `CATEGORIAS` e `PRODUTOS_MAP`. Não requer alterações nas páginas HTML.

## Variáveis CSS relevantes

`--sidebar-w` (260px), `--sidebar-bg` (#0d1b2a), `--body-bg` (#f1f5f9), `--sb-color` (#003087), `--sumol-color` (#E31E24) — em `assets/css/style.css :root`.
