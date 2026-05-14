/**
 * IPI - Serviço de Busca
 * Gerencia a consulta de veículos e pessoas nos 3 modos.
 */

class ServicoBusca {
    /**
     * Busca veículo por placa
     * @param {string} placa 
     * @returns { resultado, modo, latenciaMs }
     */
    async buscarVeiculo(placa) {
        const inicio = performance.now();
        const modo = window.connMgr.obterModo();
        let resultado = null;

        if (modo === 'NUVEM') {
            resultado = await this._veiculoNuvem(placa);
        } else if (modo === 'SMS') {
            // Tenta cache local primeiro
            resultado = await window.ipiDB.buscarVeiculo(placa);
            if (!resultado) {
                // Em cenário real: envia consulta via SMS
                resultado = this._espacoReservadoSMS(placa);
            }
        } else {
            // BLACKOUT — apenas local
            resultado = await window.ipiDB.buscarVeiculo(placa);
        }

        const latenciaMs = Math.round(performance.now() - inicio);
        return { resultado, modo, latenciaMs };
    }

    /**
     * Busca pessoa por CPF ou nome
     * @param {string} consulta 
     */
    async buscarPessoa(consulta) {
        const inicio = performance.now();
        const modo = window.connMgr.obterModo();
        let resultados = [];
        const cpfLimpo = consulta.replace(/\D/g, '');
        const ehCPF = cpfLimpo.length === 11;

        if (modo === 'NUVEM') {
            resultados = await this._pessoaNuvem(consulta);
        } else if (modo === 'SMS') {
            resultados = await this._buscaPessoaLocal(consulta, ehCPF);
        } else {
            resultados = await this._buscaPessoaLocal(consulta, ehCPF);
        }

        const latenciaMs = Math.round(performance.now() - inicio);
        return { resultados, modo, latenciaMs };
    }

    async _buscaPessoaLocal(consulta, ehCPF) {
        if (ehCPF) {
            const cpf = consulta.replace(/\D/g, '');
            const formatado = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
            const r = await window.ipiDB.buscarPessoaPorCPF(formatado);
            return r ? [r] : [];
        } else {
            return await window.ipiDB.buscarPessoaPorNome(consulta);
        }
    }

    async _veiculoNuvem(placa) {
        if (!window.supabaseClient) {
            return null; // Sem cliente, sem busca em nuvem real
        }

        try {
            const { data, error } = await window.supabaseClient
                .from('veiculos')
                .select('*')
                .eq('placa', placa.toUpperCase())
                .single();

            if (error && error.code !== 'PGRST116') {
                console.error('[ServicoBusca] Erro na nuvem (Veículo):', error);
                return null;
            }

            if (data) {
                return { ...data, origem: 'NUVEM' };
            }
        } catch (e) {
            console.error('[ServicoBusca] Exceção:', e);
        }
        return null;
    }

    async _pessoaNuvem(consulta) {
        const ehCPF = consulta.replace(/\D/g, '').length === 11;
        
        if (!window.supabaseClient) {
            return []; // Sem cliente, sem busca em nuvem real
        }

        try {
            let query = window.supabaseClient.from('pessoas').select('*');
            
            if (ehCPF) {
                const cpf = consulta.replace(/\D/g, '');
                const formatado = `${cpf.slice(0, 3)}.${cpf.slice(3, 6)}.${cpf.slice(6, 9)}-${cpf.slice(9)}`;
                query = query.eq('cpf', formatado);
            } else {
                query = query.ilike('nome', `%${consulta}%`);
            }

            const { data, error } = await query;

            if (error) {
                console.error('[ServicoBusca] Erro na nuvem (Pessoa):', error);
                return [];
            }

            if (data) {
                return data.map(r => ({ ...r, origem: 'NUVEM' }));
            }
        } catch (e) {
            console.error('[ServicoBusca] Exceção:', e);
        }
        return [];
    }

    _espacoReservadoSMS(placa) {
        // Codifica e "envia" SMS - em produção o plugin Capacitor SMS cuidaria disso
        const sms = window.connMgr.codificarSMS('CONSULTA_VEIC', { placa });
        console.log('[ServicoBusca] Consulta SMS codificada:', sms);
        return { placa, modelo: 'AGUARD. RETORNO SMS', situacao: 'PENDENTE', origem: 'CONSULTA_SMS' };
    }
}

window.servicoBusca = new ServicoBusca();

