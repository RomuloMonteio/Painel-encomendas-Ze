# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Stack

HTML5 · CSS3 · JavaScript (ES Modules) · Firebase 10 (Auth + Firestore) · Bootstrap 5.3 · jsPDF 2.5 + autoTable

Sem servidor, sem PHP, sem build step — servir os ficheiros estáticos diretamente.

## Configuração inicial

1. Criar projeto Firebase em [console.firebase.google.com](https://console.firebase.google.com)
2. Activar **Authentication → Email/Password**
3. Criar base de dados **Firestore** em modo produção
4. Preencher `assets/js/firebase.js` com as credenciais do projeto
5. Publicar `firestore.rules` no projeto (Firebase CLI: `firebase deploy --only firestore:rules`)
6. Criar utilizadores em **Authentication → Users** no Firebase Console
7. Para cada utilizador, criar documento em Firestore `users/{uid}` com `{ nome: "Nome", nivel: "admin" | "funcionario" }`
8. Servir com qualquer servidor estático (ex.: `npx serve .` ou extensão Live Server do VS Code)

> Os ES Modules requerem que os ficheiros sejam servidos via HTTP(S), não via `file://`.

## Estrutura de pastas

```
index.html           login
dashboard.html       dashboard principal
encomendas.html      formulário de encomenda (?marca=super-bock|sumol)
historico.html       histórico com filtros client-side e paginação
firestore.rules      regras de segurança do Firestore

assets/
  css/style.css        design completo (variáveis CSS, layout, formulário, tabela)
  js/
    firebase.js        initializeApp + export auth, db
    data.js            dados estáticos: MARCAS, CATEGORIAS, PRODUTOS_MAP
    layout.js          initPage() — auth guard, sidebar/topbar injection, logout
    pdf.js             gerarPDF(encomenda) via jsPDF + autoTable
    pages/
      dashboard.js     stats Firestore, gráfico Chart.js, tabela últimas
      encomendas.js    buildForm(), submit → Firestore, geração de número atómico
      historico.js     load 200 encomendas, filtros client-side, paginação, updateDoc estado
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
Client-side sobre até 200 documentos carregados de uma vez. Adequado para volume de um restaurante. Paginação também client-side (20 por página).

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
