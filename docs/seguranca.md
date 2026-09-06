# IPI — Segurança da Informação (Pt06 §25 / RNF-001 / §20.4)

## 1. Criptografia em repouso
- **Web:** `db-engine.js:71` AES-256-CBC com chave derivada `PBKDF2(salt 16B, iv 16B, 100k iterações, SHA-256)` + `gerarChaveDerivada(SHA-256(matricula:ipi:sqlcipher:v1))`. Export `db.export()` criptografado em `localStorage[ipi-crypt-key-v1]`.
- **Nativo:** `@capacitor-community/sqlite` com `SQLCipher` (`password = chaveDerivada` em `_abrirNative`).
- **Senhas:** `seed-policiais.js:1` PBKDF2 `salt 32B + 100k + SHA-256` → `salt:hash` base64; `auth.js:_derivarSenha` verifica idem.

## 2. Autenticação
- Login offline-first: `auth.js:login` tenta Supabase, fallback `ipiDB.buscarPolicial` local (cache populado no primeiro login online e via `seedPolicial`).
- `redefinirSenha` online PATCH Supabase, offline atualiza cache local + `pendente_senha_{matricula}` para sync.

## 3. RLS Supabase
- `002_rls_policies.sql`: `enable row level security` em todas as tabelas; `veiculos/pessoas` só `select` para `anon`; `policiais select_own`.
- `003_rn006_imutabilidade.sql`: trigger `prevenir_edicao_ocorrencia_sincronizada` bloqueia `UPDATE/DELETE` onde `sincronizado=1`.

## 4. Auditoria (§20.4)
- Tabela `auditoria_consultas` (matrícula, tipo, parâmetro, modo, município, timestamp) + RLS.
- Cada `buscarVeiculo/buscarPessoa` chama `ipiDB.registrarAuditoriaConsulta` (nuvem quando online + fallback `auditoria_logs` local 500 últimos).

## 5. Configuração segura
- `configSupabase.js` suporta `window.__IPI_CONFIG__` / `meta` / `localStorage` para não hardcodar em prod (Vercel env). `supabaseApi.js` fallback REST com `apikey` header.
- `.env.example` + `.gitignore` (não commitar `.env`).

## 6. LGPD / Auditoria jurídica (RN-006)
- Ocorrência sincronizada imutável local (`db.js:39`) e nuvem (trigger). `limparTudo` loga warning se houver sincronizadas.
- Logs de consulta permitem rastreabilidade por `matricula_operador`.
