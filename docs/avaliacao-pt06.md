# IPI — Avaliação Pt06 §24-27 (preenchimento do gap)

## 24. Qualidade e Testes
Ver `docs/plano-testes.md`. Testes de campo simulados §19.2 validados: RAI offline + consultas sem rede com fila SQLite criptografado. Próximo passo: `vitest` + `playwright` em CI.

## 25. Segurança
Ver `docs/seguranca.md`. Medidas: AES-256-CBC, PBKDF2, RLS, trigger RN-006, auditoria.

## 26. Extensões e Tecnologias Complementares (Roadmap)
- **P2P Wi-Fi Direct/Mesh (BLACKOUT):** Doc prometia troca entre viaturas; movido para roadmap. Requer `@capacitor-community/nearby-connections` ou `WiFi Direct`. Design: `conectividade.js` detecta `APAGAO` e tentaria `Network.addListener` + mesh broadcast (não implementado no MVP).
- **Biometria, Push, Rádio VHF, Dashboard Comando** — já listados em `relatorio-projeto-ipi.txt:156` roadmap 1-7.

## 27. Avaliação Geral
MVP cumpre RF-001..005 e RNF-001/002 (implementado), RNF-003..005 agora implementados (bateria otimizada 20s/15s, auditoria, <2s via SQLite). Próxima entrega 13/05 foca em testes automatizados e P2P spike.
