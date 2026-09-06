# IPI — Plano de Testes (Pt06 §24)

## 1. Estratégia
Offline-first validado em 3 camadas: **Unidade (JS), Integração (SQLite/Supabase), Campo (Capacitor)**.
Ferramenta: `vitest` + `playwright` (E2E). Sem framework frontend, testes rodam direto no `www/` via `serve`.

## 2. Casos por Requisito

| ID | Cenário | Passos | Critério |
|----|---------|--------|----------|
| RF-001 | RAI offline BLACKOUT | Simular `connMgr.forcarModo('APAGAO')`, preencher `tipo+desc(>=10)`, `salvarRAI()`, verificar `sincronizado=0` em `ocorrencias` | `obterOcorrenciasPendentes()` contém RAI |
| RF-002 | Consulta placa cache | Seed `ABC1D23` ROUBADO, `buscarVeiculo('ABC1D23')` em APAGAO | `resultado.situacao=ROUBADO`, `latencia<2000ms` (RNF-005) |
| RF-002 | Consulta CPF com acento | Seed `João`, buscar `joao` sem acento | `buscarPessoaPorNome` retorna via `_normMunicipio` |
| RF-003 | Sync ao voltar NUVEM | Criar 2 pendentes, `liberarForca()` + `_verificar()` → `sincronizar()` | `marcarSincronizada` chamado, `contagem-sync` 0 |
| RF-004 | SMS Fallback | Modo SMS, placa inexistente local → `_veiculoSMS` envia `IPI|CONSULTA_VEIC|...` | `sms-service` retorna `sucesso:true` + auditoria |
| RN-006 | Imutabilidade | `salvarOcorrencia` com `id` já `sincronizado=1` → throw | Supabase trigger `prevenir_edicao...` bloqueia `UPDATE` |
| RN-007 | Alternância automática | `navigator.onLine=false` + `CLOUD_CONEXAO_URL` 500 ×6 | `mudancamodo` NUVEM→SMS (3 falhas) →APAGAO (6) |
| RN-005 | Seletividade município | `definirMissao('Goiânia')` + `atualizarCacheNuvem` | `supabase` query `eq(municipio, Goiânia)` canônico |

## 3. Segurança (RNF-001, §25)
- `db-engine.js`: `gerarChaveDerivada` SHA-256 + PBKDF2 100k AES-256-CBC; teste: `btoa` localStorage contém `salt+iv+ciphertext` (48+ bytes)
- `seed-policiais.js`: `gerarHashSenha` salt 32B + deriveBits 256b
- RLS `002_rls_policies.sql`: `anon` só `select` veículos/pessoas; `policiais` update próprio
- `auditoria_consultas` tabela + `registrarAuditoriaConsulta` local + nuvem

## 4. Performance (RNF-003/005)
- Latência `servicoBusca` medida via `performance.now()` exibida em `latencia-busca`
- Bateria: `INTERVALO_VERIFICACAO 20s`, `INTERVALO_SINCRONIZACAO 15s` — medir com `adb shell dumpsys batterystats`

## 5. Execução
```bash
npm install
npx vitest run  # unidade
npx playwright test # E2E em www/index.html
```

## 6. Evidências campo (§19.2)
DevTools `offline` + `npx cap open android` → `adb logcat | grep IPI` → validar `fila SQLite criptografado`.
