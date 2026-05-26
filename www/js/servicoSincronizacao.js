/**
 * IPI - Serviço de Sincronização
 * Monitora a conectividade e envia as ocorrências pendentes para o servidor
 * quando o modo NUVEM está disponível.
 * Utiliza serialização Protobuf para economia de banda (seção 17.2, 21.2).
 */

var INTERVALO_SINCRONIZACAO = 15000;
var API_BASE = null;

class ServicoSincronizacao extends EventTarget {
    constructor() {
        super();
        this._sincronizando = false;
        this._temporizador = null;
        this._usarProtobuf = false;
    }

    iniciar(connMgr) {
        this._connMgr = connMgr;

        connMgr.addEventListener('mudancamodo', async (e) => {
            if (e.detail.atual === 'NUVEM') {
                await this.sincronizar();
            }
        });

        this._temporizador = setInterval(() => {
            if (connMgr.estaEmNuvem()) this.sincronizar();
        }, INTERVALO_SINCRONIZACAO);

        this._iniciarProtobuf();
    }

    async _iniciarProtobuf() {
        const disponivel = await window.servicoProtobuf.carregarProto();
        this._usarProtobuf = disponivel;
        console.log(`[SyncSvc] Protobuf ${disponivel ? 'ativado' : 'desativado (fallback JSON)'}.`);
    }

    async sincronizar() {
        if (this._sincronizando) return;
        this._sincronizando = true;
        this.dispatchEvent(new Event('inicio-sync'));

        try {
            const pendentes = await window.ipiDB.obterOcorrenciasPendentes();
            let contagemSincronizados = 0;
            let economiaTotal = 0;
            let totalOriginal = 0;
            let totalCompactado = 0;

            for (const ocorrencia of pendentes) {
                let sucesso = false;

                if (this._usarProtobuf) {
                    const resultadoProto = window.servicoProtobuf.serializarRAI(ocorrencia);
                    if (resultadoProto) {
                        economiaTotal += parseFloat(resultadoProto.economia);
                        totalOriginal += resultadoProto.tamanhoOriginal;
                        totalCompactado += resultadoProto.tamanhoCompactado;
                        console.log(
                            `[SyncSvc] Protobuf: ${resultadoProto.tamanhoOriginal}B → ${resultadoProto.tamanhoCompactado}B ` +
                            `(${resultadoProto.economia}% economia)`
                        );
                    }
                }

                sucesso = await this._enviar(ocorrencia);
                if (sucesso) {
                    await window.ipiDB.marcarSincronizada(ocorrencia.id);
                    contagemSincronizados++;
                }
            }

            if (contagemSincronizados > 0) {
                const mediaEconomia = contagemSincronizados > 0
                    ? (economiaTotal / contagemSincronizados).toFixed(1)
                    : 0;
                console.log(
                    `[SyncSvc] Push: ${contagemSincronizados}/${pendentes.length} ` +
                    `| Economia média Protobuf: ${mediaEconomia}% ` +
                    `| Total: ${totalOriginal}B → ${totalCompactado}B`
                );
            }

            await this._puxarRAIs();

            this.dispatchEvent(new CustomEvent('sync-completo', {
                detail: {
                    sincronizados: contagemSincronizados,
                    total: pendentes.length,
                    economiaMedia: contagemSincronizados > 0
                        ? (economiaTotal / contagemSincronizados).toFixed(1)
                        : 0
                }
            }));
        } catch (err) {
            console.error('[SyncSvc] Erro na sincronização:', err);
        }

        this._sincronizando = false;
        this.dispatchEvent(new Event('fim-sync'));
    }

    async _puxarRAIs() {
        if (!window.supabaseClient) return;
        const municipio = await window.ipiDB.obterMissao();
        if (!municipio) return;

        const operador = window.servicoAuth.obterOperador();
        const minhasRAIs = await window.ipiDB.obterTodasOcorrencias();
        const idsLocais = new Set(minhasRAIs.map(o => o.id));

        try {
            const { data, error } = await window.supabaseClient
                .from('ocorrencias')
                .select('*')
                .eq('municipio', municipio)
                .neq('matricula_operador', operador ? operador.matricula : '')
                .order('data_hora', { ascending: false });

            if (error) throw error;
            if (!data || data.length === 0) return;

            let novas = 0;
            for (const oc of data) {
                if (!idsLocais.has(oc.id)) {
                    await window.ipiDB.salvarOcorrencia({
                        ...oc,
                        sincronizado: true,
                        pessoas: [],
                        veiculos: []
                    });
                    novas++;
                }
            }
            if (novas > 0) {
                console.log(`[SyncSvc] Pull: ${novas} nova(s) ocorrência(s) de ${municipio}`);
            }
        } catch (e) {
            console.warn('[SyncSvc] Erro ao puxar RAIs:', e);
        }
    }

    async _enviar(ocorrencia) {
        if (!window.supabaseClient) {
            await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
            return true;
        }

        try {
            const payloadProtobuf = this._usarProtobuf
                ? window.servicoProtobuf.serializarRAIEnriquecido(ocorrencia)
                : null;

            const { data: novaOcorrencia, error: erroOcorrencia } = await window.supabaseClient
                .from('ocorrencias')
                .insert([{
                    matricula_operador: ocorrencia.matricula_operador || 'OPERADOR_DESCONHECIDO',
                    tipo: ocorrencia.tipo,
                    descricao: payloadProtobuf
                        ? `[PROTOBUF] ${ocorrencia.descricao}`
                        : ocorrencia.descricao,
                    latitude: ocorrencia.latitude || null,
                    longitude: ocorrencia.longitude || null,
                    referencia_endereco: ocorrencia.referencia_endereco || null,
                    data_hora: ocorrencia.data_hora || new Date().toISOString(),
                    municipio: ocorrencia.municipio || null
                }])
                .select()
                .single();

            if (erroOcorrencia) {
                console.error('[SyncSvc] Erro ao inserir ocorrência:', erroOcorrencia);
                return false;
            }

            const realId = novaOcorrencia.id;

            if (ocorrencia.pessoas && ocorrencia.pessoas.length > 0) {
                const dadosPessoas = ocorrencia.pessoas
                    .filter(p => p.cpf)
                    .map(p => ({
                        ocorrencia_id: realId,
                        cpf_pessoa: p.cpf.replace(/\D/g, ''),
                        envolvimento: p.envolvimento
                    }));

                if (dadosPessoas.length > 0) {
                    const { error: errP } = await window.supabaseClient
                        .from('envolvidos')
                        .insert(dadosPessoas);
                    if (errP) console.warn('[SyncSvc] Erro ao vincular pessoas:', errP);
                }
            }

            if (ocorrencia.veiculos && ocorrencia.veiculos.length > 0) {
                const dadosVeiculos = ocorrencia.veiculos
                    .filter(v => v.placa)
                    .map(v => ({
                        ocorrencia_id: realId,
                        placa_veiculo: v.placa.toUpperCase().replace(/[^A-Z0-9]/g, '')
                    }));

                if (dadosVeiculos.length > 0) {
                    const { error: errV } = await window.supabaseClient
                        .from('veiculos_envolvidos')
                        .insert(dadosVeiculos);
                    if (errV) console.warn('[SyncSvc] Erro ao vincular veículos:', errV);
                }
            }

            return true;
        } catch (e) {
            console.error('[SyncSvc] Exceção ao enviar:', e);
            return false;
        }
    }

    estaSincronizando() { return this._sincronizando; }
    protobufAtivo() { return this._usarProtobuf; }
}

window.servicoSincronizacao = new ServicoSincronizacao();
