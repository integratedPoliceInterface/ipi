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
            // Mapeando a ocorrência local para o banco Supabase
            const { error: erroOcorrencia } = await window.supabaseClient
                .from('ocorrencias')
                .insert([{
                    id: ocorrencia.id,
                    operador_id: ocorrencia.operador_id || 'OPERADOR_DESCONHECIDO',
                    tipo: ocorrencia.tipo,
                    descricao: ocorrencia.descricao,
                    latitude: ocorrencia.localizacao?.latitude || null,
                    longitude: ocorrencia.localizacao?.longitude || null,
                    endereco_hint: ocorrencia.localizacao?.endereco_hint || null,
                    // Se o app gera a data de criação:
                    timestamp: ocorrencia.timestamp || new Date().toISOString()
                }]);

            if (erroOcorrencia) {
                console.error('[SyncSvc] Erro ao inserir ocorrência no Supabase:', erroOcorrencia);
                return false;
            }

            // Opcional: Aqui poderíamos inserir também em ocorrencia_pessoas e ocorrencia_veiculos
            // iterando em ocorrencia.pessoas e ocorrencia.veiculos

            return true;
        } catch (e) {
            console.error('[SyncSvc] Exceção ao enviar ocorrência para nuvem:', e);
            return false;
        }
    }

    estaSincronizando() { return this._sincronizando; }
}

window.servicoSincronizacao = new ServicoSincronizacao();

