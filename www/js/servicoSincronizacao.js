/**
 * IPI - Serviço de Sincronização
 * Monitora a conectividade e envia as ocorrências pendentes para o servidor
 * quando o modo NUVEM está disponível.
 */

const INTERVALO_SINCRONIZACAO = 15000; // 15 segundos
const API_BASE = null; // Substituir pela URL real da API SSP-GO

class ServicoSincronizacao extends EventTarget {
    constructor() {
        super();
        this._sincronizando = false;
        this._temporizador = null;
    }

    iniciar(connMgr) {
        this._connMgr = connMgr;

        // Sincroniza imediatamente ao mudar para o modo NUVEM
        connMgr.addEventListener('mudancamodo', async (e) => {
            if (e.detail.atual === 'NUVEM') {
                await this.sincronizar();
            }
        });

        // Sincronização periódica quando em modo nuvem
        this._temporizador = setInterval(() => {
            if (connMgr.estaEmNuvem()) this.sincronizar();
        }, INTERVALO_SINCRONIZACAO);
    }

    async sincronizar() {
        if (this._sincronizando) return;
        this._sincronizando = true;
        this.dispatchEvent(new Event('inicio-sync'));

        try {
            const pendentes = await window.ipiDB.obterOcorrenciasPendentes();
            if (pendentes.length === 0) {
                this._sincronizando = false;
                this.dispatchEvent(new Event('fim-sync'));
                return;
            }

            console.log(`[SyncSvc] Sincronizando ${pendentes.length} ocorrência(s) pendente(s)...`);
            let contagemSincronizados = 0;

            for (const ocorrencia of pendentes) {
                const sucesso = await this._enviar(ocorrencia);
                if (sucesso) {
                    await window.ipiDB.marcarSincronizada(ocorrencia.id);
                    contagemSincronizados++;
                }
            }

            this.dispatchEvent(new CustomEvent('sync-completo', { detail: { sincronizados: contagemSincronizados, total: pendentes.length } }));
            console.log(`[SyncSvc] Sincronizados ${contagemSincronizados}/${pendentes.length}`);
        } catch (err) {
            console.error('[SyncSvc] Erro na sincronização:', err);
        }

        this._sincronizando = false;
        this.dispatchEvent(new Event('fim-sync'));
    }

    async _enviar(ocorrencia) {
        if (!window.supabaseClient) {
            // Se o Supabase não estiver configurado, simula sucesso no modo demo local
            await new Promise(r => setTimeout(r, 300 + Math.random() * 500));
            return true;
        }

        try {
            // 1. Inserir a ocorrência principal
            // Nota: O banco espera um UUID. Se o app enviar algo diferente,
            // podemos deixar o Supabase gerar e capturar o ID.
            const { data: novaOcorrencia, error: erroOcorrencia } = await window.supabaseClient
                .from('ocorrencias')
                .insert([{
                    matricula_operador: ocorrencia.matricula_operador || 'OPERADOR_DESCONHECIDO',
                    tipo: ocorrencia.tipo,
                    descricao: ocorrencia.descricao,
                    latitude: ocorrencia.latitude || null,
                    longitude: ocorrencia.longitude || null,
                    referencia_endereco: ocorrencia.referencia_endereco || null,
                    data_hora: ocorrencia.data_hora || new Date().toISOString()
                }])
                .select()
                .single();

            if (erroOcorrencia) {
                console.error('[SyncSvc] Erro ao inserir ocorrência no Supabase:', erroOcorrencia);
                return false;
            }

            const realId = novaOcorrencia.id;

            // 2. Inserir pessoas vinculadas (envolvidos)
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

            // 3. Inserir veículos vinculados (veiculos_envolvidos)
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
            console.error('[SyncSvc] Exceção ao enviar ocorrência para nuvem:', e);
            return false;
        }
    }

    estaSincronizando() { return this._sincronizando; }
}

window.servicoSincronizacao = new ServicoSincronizacao();

