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
3. Todas as funcionalidades funcionarão (IndexedDB, GPS, modo offline)

> **Nota**: Para simular modo mobile, pressione `F12` no Chrome → ícone de dispositivo móvel no topo.

---

## Estrutura do Projeto

```
ipi/
├── www/                          ← Código principal da aplicação
│   ├── index.html                ← Shell principal com todos os ecrãs
│   ├── css/
│   │   └── theme.css             ← Tema tático dark mode
│   ├── js/
│   │   ├── db.js                 ← Banco IndexedDB (offline persistence)
│   │   ├── connectivity.js       ← Gerenciador de conectividade (3 modos)
│   │   ├── searchService.js      ← Consulta veículo/pessoa
│   │   ├── syncService.js        ← Sincronização automática
│   │   └── app.js                ← Controlador principal da interface
│   └── proto/
│       └── ipi.proto             ← Definições Protobuf (para integração futura)
├── package.json                  ← Dependências npm + Capacitor
├── capacitor.config.json         ← Configuração do Capacitor
└── android/                      ← (criado após `npx cap add android`)
```

---

## Funcionalidades Implementadas

| Módulo | Descrição | Status |
|--------|-----------|--------|
| Dashboard Tático | Painel principal com modo de conectividade | ✅ |
| Novo RAI | Registro de Atendimento Integrado | ✅ |
| Consulta Veículo | Busca por placa (CLOUD/FALLBACK/BLACKOUT) | ✅ |
| Consulta Pessoa | Busca por CPF ou nome | ✅ |
| Histórico | Lista de RAIs registrados com status sync | ✅ |
| Persistência Local | IndexedDB com reset e seed de dados | ✅ |
| 3 Modos de Operação | CLOUD → FALLBACK → BLACKOUT automático | ✅ |
| GPS automático | Captura de localização no RAI | ✅ |
| Sincronização | Upload automático ao retornar ao CLOUD | ✅ |
| Configurações | Dados do policial, teste de modos | ✅ |
| Capacitor | Configurado para build Android/iOS | ✅ |
