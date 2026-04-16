/**
 * IPI - Gerenciador de Conectividade
 * Gerencia os três modos operacionais:
 *   NUVEM → Acesso total à API do servidor (4G/WiFi)
 *   SMS   → Codificação/decodificação SMS para dados críticos (FALLBACK)
 *   APAGAO → Totalmente offline, apenas cache local (BLACKOUT)
 */

const MODOS = {
    NUVEM: 'NUVEM',
    SMS: 'SMS',
    APAGAO: 'APAGAO'
};

const CLOUD_CONEXAO_URL = null;          // endpoint SSP-GO
const INTERVALO_VERIFICACAO = 20000;    // 20 segundos
const LIMITE_SMS = 3;                   // Falhas consecutivas antes de → SMS
const LIMITE_APAGAO = 6;                // Falhas consecutivas antes de → APAGAO

class GerenciadorConectividade extends EventTarget {
    constructor() {
        super();
        this.modo = MODOS.NUVEM;
        this._contagemFalhas = 0;
        this._temporizadorHeartbeat = null;
        this._forcado = null; // Teste manual
    }

    async iniciar() {
        await this._verificar();
        this._temporizadorHeartbeat = setInterval(() => this._verificar(), INTERVALO_VERIFICACAO);
        window.addEventListener('online', () => this._verificar());
        window.addEventListener('offline', () => this._aplicarApagao());
        console.log('[GerenciadorConectividade] Inicializado. Modo:', this.modo);
    }

    async _verificar() {
        if (this._forcado) return; // desabilita auto-switch no modo de teste

        if (!navigator.onLine) {
            this._contagemFalhas++;
        } else {
            // Tenta um ping real se a URL estiver fornecida, caso contrário assume nuvem
            if (CLOUD_CONEXAO_URL) {
                try {
                    const ctrl = new AbortController();
                    const tid = setTimeout(() => ctrl.abort(), 3000);
                    const res = await fetch(CLOUD_CONEXAO_URL, { signal: ctrl.signal, method: 'HEAD' });
                    clearTimeout(tid);
                    if (res.ok) {
                        this._contagemFalhas = 0;
                    } else {
                        this._contagemFalhas++;
                    }
                } catch {
                    this._contagemFalhas++;
                }
            } else {
                // No ping URL → trata browser.onLine como verdade
                this._contagemFalhas = navigator.onLine ? 0 : this._contagemFalhas + 1;
            }
        }

        if (this._contagemFalhas === 0) {
            this._aplicarNuvem();
        } else if (this._contagemFalhas < LIMITE_APAGAO) {
            this._aplicarSMS();
        } else {
            this._aplicarApagao();
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
        console.log(`[ConnMgr] Modo: ${anterior} → ${novoModo}`);
        this.dispatchEvent(new CustomEvent('mudancamodo', { detail: { anterior, atual: novoModo } }));
    }

    // Força o modo para teste
    forcarModo(modo) {
        this._forcado = modo;
        this._definirModo(modo);
    }
    liberarForca() {
        this._forcado = null;
    }

    obterModo() { return this._forcado || this.modo; }
    estaEmNuvem() { return this.obterModo() === MODOS.NUVEM; }
    estaEmSMS() { return this.obterModo() === MODOS.SMS; }
    estaEmApagao() { return this.obterModo() === MODOS.APAGAO; }

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

