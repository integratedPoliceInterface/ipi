/**
 * IPI - Serviço de Comunicação via SMS
 * Implementa o modo FALLBACK (SMS) para consultas em áreas sem internet.
 * Conforme documentado em RF-004 e seção 20.2.2.
 */

class SMSService {
    constructor() {
        this.pluginDisponivel = false;
    }

    async iniciar() {
        if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
            try {
                const { SMS } = await import('@capacitor/sms');
                this.plugin = SMS;
                this.pluginDisponivel = true;
                console.log('[SMS] Plugin Capacitor SMS disponível.');
            } catch (e) {
                console.warn('[SMS] Plugin não disponível:', e);
            }
        } else {
            console.log('[SMS] Modo Web - SMS será simulado via console.');
        }
    }

    async enviarSMS(numeroDestino, mensagem) {
        if (this.pluginDisponivel && this.plugin) {
            try {
                await this.plugin.send({
                    numbers: [numeroDestino],
                    text: mensagem
                });
                console.log(`[SMS] Enviado para ${numeroDestino}: ${mensagem.substring(0, 50)}...`);
                return { sucesso: true, modo: 'NATIVO' };
            } catch (e) {
                console.error('[SMS] Erro ao enviar SMS nativo:', e);
                return { sucesso: false, modo: 'NATIVO', erro: e };
            }
        }

        const linkSMS = `sms:${numeroDestino}?body=${encodeURIComponent(mensagem)}`;
        try {
            window.open(linkSMS, '_system');
        } catch {
            window.location.href = linkSMS;
        }
        console.log(`[SMS] Link gerado: ${linkSMS}`);
        return { sucesso: true, modo: 'LINK' };
    }

    async consultarVeiculoSMS(placa) {
        const codificado = window.connMgr.codificarSMS('CONSULTA_VEIC', { placa });
        const numeroCentral = await window.ipiDB.obterConfiguracao('sms_central_number') || '190';

        console.log(`[SMS] Enviando consulta veicular via SMS: ${codificado}`);
        return await this.enviarSMS(numeroCentral, codificado);
    }

    async consultarPessoaSMS(cpf) {
        const codificado = window.connMgr.codificarSMS('CONSULTA_PESS', { cpf });
        const numeroCentral = await window.ipiDB.obterConfiguracao('sms_central_number') || '190';

        console.log(`[SMS] Enviando consulta pessoal via SMS: ${codificado}`);
        return await this.enviarSMS(numeroCentral, codificado);
    }

    async enviarRAIViaSMS(ocorrencia) {
        const payloadProto = await window.servicoProtobuf.serializarRAIEnriquecido(ocorrencia);
        const mensagem = payloadProto
            ? window.connMgr.codificarSMS('RAI', payloadProto)
            : window.connMgr.codificarSMS('RAI_JSON', ocorrencia);

        const numeroCentral = await window.ipiDB.obterConfiguracao('sms_central_number') || '190';
        return await this.enviarSMS(numeroCentral, mensagem);
    }
}

window.servicoSMS = new SMSService();
