/**
 * IPI - Gerenciador de Conectividade
 * Gerencia os três modos operacionais (RN-007 - Alternância Automática):
 *   NUVEM  → Acesso total à API do servidor (4G/WiFi)
 *   SMS    → Fallback via mensagens de texto codificadas (RF-004)
 *   APAGAO → Totalmente offline, apenas cache local (BLACKOUT)
 *            - P2P Wi-Fi Direct/Mesh entre viaturas previsto em roadmap (não integra MVP).
 *
 * A transição entre modos é AUTOMÁTICA (RN-007).
 * O modo forçado manual é apenas para TESTE e exibe indicador visual.
 */

var MODOS = {
    NUVEM: 'NUVEM',
    SMS: 'SMS',
    APAGAO: 'APAGAO'
};

var CLOUD_CONEXAO_URL = null; // definido dinamicamente em iniciar() a partir de window.IPI_SUPABASE_URL
var INTERVALO_VERIFICACAO = 20000;
var LIMITE_SMS = 3;
var LIMITE_APAGAO = 6;

class GerenciadorConectividade extends EventTarget {
    constructor() {
        super();
        this.modo = MODOS.NUVEM;
        this._contagemFalhas = 0;
        this._temporizadorHeartbeat = null;
        this._forcado = null;
        this._modoAnterior = null;
    }

    async iniciar() {
        // Resolve URL de healthcheck dinamicamente (evita CLOUD_CONEXAO_URL=null inoperante)
        if (!CLOUD_CONEXAO_URL) {
            const base = (typeof window !== 'undefined' && (window.IPI_SUPABASE_URL || window.SUPABASE_URL)) || null;
            if (base) {
                CLOUD_CONEXAO_URL = base.replace(/\/$/, '') + '/rest/v1/';
                console.log('[ConnMgr] Healthcheck URL:', CLOUD_CONEXAO_URL);
            }
        }
        // Integração com Capacitor Network se disponível
        try {
            if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
                const { Network } = await import('@capacitor/network');
                const status = await Network.getStatus();
                if (!status.connected) this._contagemFalhas = LIMITE_APAGAO;
                Network.addListener('networkStatusChange', (s) => {
                    console.log('[ConnMgr] Network status change:', s);
                    if (!s.connected) { this._contagemFalhas = LIMITE_APAGAO; this._aplicarApagao(); }
                    else this._verificar();
                });
            }
        } catch (e) { console.warn('[ConnMgr] Capacitor Network não disponível:', e.message); }

        await this._verificar();
        this._temporizadorHeartbeat = setInterval(() => this._verificar(), INTERVALO_VERIFICACAO);
        window.addEventListener('online', () => {
            console.log('[ConnMgr] Evento online detectado. Verificando...');
            this._verificar();
        });
        window.addEventListener('offline', () => {
            console.log('[ConnMgr] Evento offline detectado. → APAGAO');
            this._aplicarApagao();
        });
        console.log('[ConnMgr] Inicializado. Modo:', this.modo);
    }

    async _verificar() {
        if (this._forcado) return;

        const estavaOffline = !navigator.onLine;

        if (!navigator.onLine) {
            this._contagemFalhas++;
        } else {
            if (CLOUD_CONEXAO_URL) {
                try {
                    const ctrl = new AbortController();
                    const tid = setTimeout(() => ctrl.abort(), 3000);
                    const headers = {};
                    const _key = (typeof window !== 'undefined' && (window.IPI_SUPABASE_KEY || window.SUPABASE_KEY)) || null;
                    if (_key) { headers['apikey'] = _key; headers['Authorization'] = 'Bearer ' + _key; }
                    const res = await fetch(CLOUD_CONEXAO_URL, { signal: ctrl.signal, method: 'HEAD', headers });
                    clearTimeout(tid);
                    // Qualquer resposta HTTP (inclusive 401) indica que a rede está OK; só erro de rede incrementa
                    if (res.ok || res.status === 401 || res.status === 404) this._contagemFalhas = 0;
                    else this._contagemFalhas++;
                } catch {
                    this._contagemFalhas++;
                }
            } else {
                this._contagemFalhas = 0;
            }
        }

        const modoAnterior = this.modo;

        if (this._contagemFalhas === 0) {
            this._aplicarNuvem();
        } else if (this._contagemFalhas <= LIMITE_SMS) {
            this._aplicarSMS();
        } else if (this._contagemFalhas < LIMITE_APAGAO) {
            this._aplicarSMS();
        } else {
            this._aplicarApagao();
        }

        if (estavaOffline && this.modo === MODOS.NUVEM) {
            console.log('[ConnMgr] Recuperação de conectividade detectada.');
            this.dispatchEvent(new CustomEvent('recuperado', {
                detail: { modoAnterior, modoAtual: this.modo }
            }));
        }
    }

    _aplicarNuvem() {
        this._definirModo(MODOS.NUVEM);
    }

    _aplicarSMS() {
        this._definirModo(MODOS.SMS);
    }

    _aplicarApagao() {
        this._definirModo(MODOS.APAGAO);
    }

    _definirModo(novoModo) {
        if (this.modo === novoModo) return;
        const anterior = this.modo;
        this.modo = novoModo;
        console.log(`[ConnMgr] Modo automático: ${anterior} → ${novoModo}`);
        this.dispatchEvent(new CustomEvent('mudancamodo', { detail: { anterior, atual: novoModo } }));
    }

    forcarModo(modo) {
        this._forcado = modo;
        this._definirModo(modo);
        console.log(`[ConnMgr] MODO FORÇADO (TESTE): ${modo}`);
    }

    liberarForca() {
        if (this._forcado) {
            console.log(`[ConnMgr] Liberando modo forçado. Retomando automático...`);
            this._forcado = null;
            this._contagemFalhas = 0;
            this._verificar();
        }
    }

    obterModo() { return this._forcado || this.modo; }
    estaEmNuvem() { return this.obterModo() === MODOS.NUVEM; }
    estaEmSMS() { return this.obterModo() === MODOS.SMS; }
    estaEmApagao() { return this.obterModo() === MODOS.APAGAO; }
    estaEmModoTeste() { return this._forcado !== null; }

    /**
     * Codifica payload para string segura para SMS (modo SMS)
     * Formato: IPI|TIPO|BASE64PAYLOAD
     */
    codificarSMS(tipo, payload) {
        const b64 = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
        return `IPI|${tipo}|${b64}`;
    }

    decodificarSMS(bruto) {
        try {
            const partes = bruto.split('|');
            if (partes[0] !== 'IPI' || partes.length < 3) return null;
            const payload = JSON.parse(decodeURIComponent(escape(atob(partes[2]))));
            return { tipo: partes[1], payload };
        } catch {
            return null;
        }
    }
}

window.connMgr = new GerenciadorConectividade();
