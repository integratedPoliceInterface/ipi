/**
 * IPI - Serviço de Busca
 * Gerencia a consulta de veículos e pessoas nos 3 modos.
 * Modo SMS (Fallback) agora envia consulta real via SMS (RF-004).
 */

class ServicoBusca {
    async buscarVeiculo(placa) {
        const inicio = performance.now();
        const modo = window.connMgr.obterModo();
        let resultado = null;

        if (modo === 'NUVEM') {
            resultado = await this._veiculoNuvem(placa);
        } else if (modo === 'SMS') {
            resultado = await window.ipiDB.buscarVeiculo(placa);
            if (!resultado) {
                resultado = await this._veiculoSMS(placa);
            }
        } else {
            // BLACKOUT: apenas cache local (P2P Wi-Fi Direct em roadmap)
            resultado = await window.ipiDB.buscarVeiculo(placa);
        }

        const latenciaMs = Math.round(performance.now() - inicio);
        // Auditoria §20.4: registra consulta
        try {
            const mun = await window.ipiDB.obterMissao();
            await window.ipiDB.registrarAuditoriaConsulta('VEICULO', placa.toUpperCase(), modo, !!resultado, mun);
        } catch {}
        return { resultado, modo, latenciaMs };
    }

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
            if (resultados.length === 0) {
                const resultadoSMS = await this._pessoaSMS(consulta, ehCPF);
                if (resultadoSMS) resultados = [resultadoSMS];
            }
        } else {
            resultados = await this._buscaPessoaLocal(consulta, ehCPF);
        }

        const latenciaMs = Math.round(performance.now() - inicio);
        try {
            const mun = await window.ipiDB.obterMissao();
            await window.ipiDB.registrarAuditoriaConsulta('PESSOA', consulta, modo, resultados.length > 0, mun);
        } catch {}
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

    async _veiculoSMS(placa) {
        console.log(`[ServicoBusca] Enviando consulta veicular via SMS: ${placa}`);
        try {
            const resultado = await window.servicoSMS.consultarVeiculoSMS(placa);
            if (resultado && resultado.sucesso) {
                return {
                    placa: placa.toUpperCase(),
                    modelo: 'CONSULTA ENVIADA VIA SMS',
                    situacao: 'AGUARDANDO RETORNO',
                    origem: 'SMS'
                };
            }
        } catch (e) {
            console.warn('[ServicoBusca] Erro no SMS:', e);
        }
        return {
            placa: placa.toUpperCase(),
            modelo: 'FALHA NO ENVIO SMS',
            situacao: 'ERRO',
            origem: 'SMS'
        };
    }

    async _pessoaSMS(consulta, ehCPF) {
        const parametro = ehCPF ? consulta.replace(/\D/g, '') : consulta;
        console.log(`[ServicoBusca] Enviando consulta pessoal via SMS: ${parametro}`);
        try {
            const resultado = await window.servicoSMS.consultarPessoaSMS(parametro);
            if (resultado && resultado.sucesso) {
                return {
                    cpf: ehCPF ? parametro : '',
                    nome: ehCPF ? `CONSULTA CPF ENVIADA VIA SMS` : `CONSULTA NOME ENVIADA VIA SMS`,
                    situacao: 'AGUARDANDO RETORNO',
                    origem: 'SMS'
                };
            }
        } catch (e) {
            console.warn('[ServicoBusca] Erro no SMS:', e);
        }
        return null;
    }

    async _veiculoNuvem(placa) {
        if (!window.supabaseClient) return null;

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

        if (!window.supabaseClient) return [];

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
}

window.servicoBusca = new ServicoBusca();
