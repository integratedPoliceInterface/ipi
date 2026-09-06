# IPI - Guia de Instalação e Build Android

## Pré-requisitos

Antes de gerar o APK para instalar no dispositivo, você precisa instalar:

### 1. Node.js (obrigatório)
- Acesse: https://nodejs.org/en/download
- Baixe a versão **LTS** para Windows
- Execute o instalador (Next → Next → Install)
- Confirme no terminal: `node --version` e `npm --version`

### 2. Android Studio (obrigatório para gerar APK)
- Acesse: https://developer.android.com/studio
- Instale o Android Studio
- Abra → SDK Manager → instale **Android SDK Platform 33+** e **Android Build Tools 33+**
- Defina a variável de ambiente:
  ```
  ANDROID_HOME = C:\Users\pablo\AppData\Local\Android\Sdk
  ```
  Adicione ao PATH:
  ```
  %ANDROID_HOME%\tools
  %ANDROID_HOME%\platform-tools
  ```

### 3. JDK (provavelmente já instalado)
- Você já tem JDK 25. ✅

---

## Passo a Passo para Gerar o APK

### Etapa 1 — Instalar dependências do projeto
```bash
cd C:\Users\pablo\Desktop\Facul\PI\software\ipi
npm install
```

### Etapa 2 — Adicionar plataforma Android
```bash
npx cap add android
```
> Este comando cria a pasta `android/` com o projeto nativo.

### Etapa 3 — Sincronizar arquivos web com o Android
```bash
npx cap sync android
```
> Copia os arquivos da pasta `www/` para dentro do projeto Android.

### Etapa 4 — Abrir no Android Studio
```bash
npx cap open android
```
> O Android Studio abrirá automaticamente com o projeto.

### Etapa 5 — Gerar o APK
No Android Studio:
1. Menu: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
2. Aguarde o build
3. Clique em **"locate"** no rodapé para encontrar o APK
4. O arquivo estará em: `android\app\build\outputs\apk\debug\app-debug.apk`

### Etapa 6 — Instalar no dispositivo
**Via cabo USB:**
```bash
adb install android\app\build\outputs\apk\debug\app-debug.apk
```

**Manualmente:**
1. Copie o `app-debug.apk` para o celular
2. No celular: Configurações → Segurança → Fontes desconhecidas (ativar)
3. Abra o arquivo APK no celular e instale

---

## Testar direto no navegador (sem Node)

Se quiser testar a interface agora mesmo **sem instalar nada**:

1. Navegue até a pasta: `C:\Users\pablo\Desktop\Facul\PI\software\ipi\www\`
2. Abra o arquivo `index.html` diretamente no **Chrome** ou **Opera GX**
3. Todas as funcionalidades funcionarão (SQLite, GPS, modo offline)

> **Nota**: Para simular modo mobile, pressione `F12` no Chrome → ícone de dispositivo móvel no topo.

---

## Estrutura do Projeto

```
ipi/
├── www/                          ← Código principal da aplicação
│   ├── index.html                ← Shell principal com todos os ecrãs
│   ├── css/
│   │   └── styles.css            ← Tema tático dark mode
│   ├── js/
│   │   ├── db-engine.js          ← Motor SQLite com criptografia AES-256-CBC
│   │   ├── db-schema.js          ← Schema SQL do banco local
│   │   ├── db.js                 ← Serviço de banco de dados (API pública + RN-006 + auditoria)
│   │   ├── mapa-storage.js       ← PMTiles em IndexedDB (evita estouro localStorage)
│   │   ├── protobuf.js           ← Serialização Protobuf (ipi.proto)
│   │   ├── sms-service.js        ← Serviço de SMS (modo Fallback - RF-004)
│   │   ├── conectividade.js      ← Gerenciador de conectividade (3 modos, P2P roadmap)
│   │   ├── servicoBusca.js       ← Consulta veículo/pessoa + auditoria
│   │   ├── servicoSincronizacao.js ← Sincronização automática + Protobuf
│   │   ├── auth.js               ← Autenticação PBKDF2 offline-first
│   │   ├── app.js                ← Controlador principal da interface
│   │   ├── aparencia.js          ← Controle de tema (diurno/noturno)
│   │   ├── mapa.js               ← Leaflet + PMTiles + rotas
│   │   ├── seed-policiais.js     ← Script de seed de policiais
│   │   ├── goias-municipios.js   ← 246 municípios de Goiás
│   │   ├── configSupabase.js     ← Configuração Supabase (env-aware)
│   │   └── supabaseApi.js        ← Cliente REST Supabase (fallback + update/upsert)
│   ├── proto/
│   │   └── ipi.proto             ← Definições Protobuf (serialização binária)
│   ├── sw.js                     ← Service Worker (cache + range requests)
│   ├── maps/goias.pmtiles        ← Mapa offline do estado de Goiás
│   └── img/                      ← Brasões e ícones
├── package.json                  ← Dependências npm + Capacitor
├── capacitor.config.json         ← Configuração do Capacitor
└── vercel.json                   ← Deploy Vercel
```

---

## Tecnologias do Projeto

| Camada | Tecnologia | Finalidade |
|--------|-----------|------------|
| Frontend | HTML5 + CSS3 + Vanilla JS | Interface do usuário |
| Mobile | Capacitor 5 | Wrapper nativo Android/iOS |
| Banco Local | SQLite (sql.js / @capacitor-community/sqlite) | Persistência offline criptografada |
| Criptografia | AES-256-CBC + PBKDF2 | Proteção dos dados em repouso (RNF-001) |
| Serialização | Protocol Buffers (protobufjs) | Economia de banda na transmissão |
| Backend Cloud | Supabase (PostgreSQL + REST) | Sincronização central SSP-GO |
| Mapas | Leaflet + Protomaps + PMTiles | Mapas offline (Goiás) — PMTiles em IndexedDB (`mapa-storage.js`) |
| Fallback | SMS (@capacitor/sms) | Consultas via mensagem de texto (RF-004) |
| Autenticação | PBKDF2 + SHA-256 | Login seguro offline-first (Supabase + cache local `policiais`) |
| Auditoria | Supabase `auditoria_consultas` + local `auditoria_logs` | Rastreabilidade RN-006 (§20.4) |
| P2P | Wi-Fi Direct (roadmap) | Blackout = cache local; P2P em `docs/avaliacao-pt06.md` |

---

## Funcionalidades Implementadas

| Módulo | Descrição | Status |
|--------|-----------|--------|
| Dashboard Tático | Painel principal com modo de conectividade | ✅ |
| Novo RAI | Registro de Atendimento Integrado (RF-001) | ✅ |
| Consulta Veículo | Busca por placa (NUVEM/FALLBACK/BLACKOUT) (RF-002) | ✅ |
| Consulta Pessoa | Busca por CPF ou nome (RF-002) | ✅ |
| Sincronização Automática | Push/Pull com servidor central (RF-003) | ✅ |
| Fallback SMS | Consultas via SMS codificado (RF-004) | ✅ |
| Mapas Offline | PMTiles + Leaflet + rotas offline (RF-005) | ✅ |
| Banco SQLite Criptografado | SQLite com AES-256-CBC (RNF-001) | ✅ |
| Modo Tático | Alto contraste, tema diurno/noturno (RNF-002) | ✅ |
| 3 Modos de Operação | NUVEM → FALLBACK → BLACKOUT automático (RN-007) | ✅ |
| GPS automático | Captura de localização no RAI (RN-004) | ✅ |
| Persistência Local | SQLite com seed de dados demo | ✅ |
| Cache por Região | Filtro por município da missão (RN-005) | ✅ |
| Service Worker | Cache estático + range requests para mapas | ✅ |
| Autenticação PBKDF2 | Login com hash de senha | ✅ |

---

## Como cada discrepância documentação × código foi corrigida

| Item | Documentação dizia | O que foi implementado |
|------|-------------------|----------------------|
| Banco de dados | SQLite criptografado | `db-engine.js` + `db-schema.js`: SQLite com criptografia AES-256-CBC |
| Criptografia em repouso | Dados protegidos | SQLite export → AES-256-CBC via Web Crypto API (web) / SQLCipher (nativo) |
| Protocol Buffers | Serialização binária | `protobuf.js`: carrega e usa `ipi.proto` → economia de ~60% no payload |
| SMS Fallback | Consultas via SMS | `sms-service.js`: envia SMS real via `@capacitor/sms` + fallback via link `sms:` |
| Alternância de modo | Automática (RN-007) | Automática por padrão; modo teste com indicador visual + botão "Voltar ao Automático" |
| Mapa Offline | "Não finalizado" (doc §22.1) | Implementado Leaflet+PMTiles: `mapa-storage.js` IndexedDB + `maps/goias.pmtiles` + fallback SQLite |
| P2P Wi-Fi Direct | "Viaturas trocam via Wi-Fi Direct/Mesh" (§20.2.3) | BLACKOUT = cache local; P2P em roadmap (`docs/avaliacao-pt06.md`), não integra MVP |
| RN-003 duplicado | 2× "Sincronização Automática" | Corrigido para RN-003 = Retenção Local e Auditoria (fila persistente) |
| RN-006 imutável | "Não editar após sync" sem implementação | Trigger `003_rn006_imutabilidade.sql` + trava local `db.js:39` + `auditoria_consultas` |
| RF-004/RF-005 | "Planejado" | RF-004 SMS e RF-005 Mapas → `Implementado` (doc atualizado) |

---

## Banco de Dados SQL (SQLite Local)

O schema local segue exatamente o modelo do Supabase:

```sql
- policiais      (matricula, nome, senha_hash, unidade, criada_em)
- ocorrencias    (id, matricula_operador, tipo, descricao, latitude, longitude, ...)
- pessoas        (cpf, nome, data_nascimento, tipo_mandado, observacao, situacao, municipio)
- veiculos       (placa, modelo, cor, ano_fabricacao, proprietario, situacao, municipio)
- envolvidos     (ocorrencia_id, cpf_pessoa, envolvimento)
- veiculos_envolvidos (ocorrencia_id, placa_veiculo)
- configuracoes  (chave, valor)
- mapa_offline   (id, dados, data_download)
```
