/**
 * IPI - Serviço de Banco de Dados (SQLite Criptografado)
 * Armazenamento local persistente com criptografia e sincronização via Supabase.
 * Em conformidade com o RNF-001 (Segurança e Sigilo dos Dados Locais).
 */

class IPIDatabase {
    async abrir(senhaMestre) {
        await window.ipiEngine.abrir(senhaMestre);
        await window.inicializarSchema();
    }

    async alterarSenha(novaSenha) {
        if (window.ipiEngine.tipo === 'web') {
            await window.ipiEngine._salvarWeb();
        }
        window.ipiEngine.chave = novaSenha;
        console.log('[DB] Chave de criptografia alterada.');
    }

    // ─── OCORRÊNCIAS ───

    async salvarOcorrencia(ocorrencia) {
        const dados = {
            id: ocorrencia.id,
            matricula_operador: ocorrencia.matricula_operador || 'OPERADOR_DESCONHECIDO',
            tipo: ocorrencia.tipo,
            descricao: ocorrencia.descricao,
            latitude: ocorrencia.latitude || null,
            longitude: ocorrencia.longitude || null,
            referencia_endereco: ocorrencia.referencia_endereco || '',
            data_hora: ocorrencia.data_hora || new Date().toISOString(),
            sincronizado: ocorrencia.sincronizado ? 1 : 0,
            modo: ocorrencia.modo || 'NUVEM',
            municipio: ocorrencia.municipio || null,
            observacoes: ocorrencia.observacoes || ''
        };

        await window.ipiEngine.salvar('ocorrencias', dados, 'id');

        if (ocorrencia.pessoas && ocorrencia.pessoas.length > 0) {
            for (const p of ocorrencia.pessoas) {
                if (p.cpf || p.nome) {
                    await window.ipiEngine.executar(
                        `INSERT OR IGNORE INTO envolvidos (ocorrencia_id, cpf_pessoa, envolvimento)
                         VALUES (?, ?, ?)`,
                        [ocorrencia.id, p.cpf || '', p.envolvimento || 'Suspeito']
                    );
                }
            }
        }

        if (ocorrencia.veiculos && ocorrencia.veiculos.length > 0) {
            for (const v of ocorrencia.veiculos) {
                if (v.placa) {
                    await window.ipiEngine.executar(
                        `INSERT OR IGNORE INTO veiculos_envolvidos (ocorrencia_id, placa_veiculo)
                         VALUES (?, ?)`,
                        [ocorrencia.id, v.placa.toUpperCase()]
                    );
                }
            }
        }
    }

    async obterTodasOcorrencias() {
        const rows = await window.ipiEngine.buscar('SELECT * FROM ocorrencias ORDER BY data_hora DESC');
        for (const row of rows) {
            const envolvidos = await window.ipiEngine.buscar(
                `SELECT e.cpf_pessoa AS cpf, e.envolvimento, p.nome
                 FROM envolvidos e LEFT JOIN pessoas p ON e.cpf_pessoa = p.cpf
                 WHERE e.ocorrencia_id = ?`,
                [row.id]
            );
            row.pessoas = envolvidos;

            const veiculos = await window.ipiEngine.buscar(
                `SELECT v.placa, v.modelo, v.cor, v.situacao
                 FROM veiculos_envolvidos ve LEFT JOIN veiculos v ON ve.placa_veiculo = v.placa
                 WHERE ve.ocorrencia_id = ?`,
                [row.id]
            );
            row.veiculos = veiculos;

            row.sincronizado = !!row.sincronizado;
        }
        return rows;
    }

    async obterOcorrenciasPendentes() {
        const rows = await this.obterTodasOcorrencias();
        return rows.filter(o => !o.sincronizado);
    }

    async marcarSincronizada(id) {
        await window.ipiEngine.executar(
            'UPDATE ocorrencias SET sincronizado = 1 WHERE id = ?',
            [id]
        );
    }

    // ─── VEÍCULOS ───

    async salvarVeiculo(veiculo) {
        await window.ipiEngine.salvar('veiculos', veiculo, 'placa');
    }

    async buscarVeiculo(placa) {
        const row = await window.ipiEngine.buscarUm(
            'SELECT * FROM veiculos WHERE placa = ?',
            [placa.toUpperCase()]
        );
        return row || null;
    }

    async obterTodosVeiculos() {
        return await window.ipiEngine.buscar('SELECT * FROM veiculos');
    }

    // ─── PESSOAS ───

    async salvarPessoa(pessoa) {
        await window.ipiEngine.salvar('pessoas', pessoa, 'cpf');
    }

    async buscarPessoaPorCPF(cpf) {
        const row = await window.ipiEngine.buscarUm(
            'SELECT * FROM pessoas WHERE cpf = ?',
            [cpf]
        );
        return row || null;
    }

    async buscarPessoaPorNome(nome) {
        return await window.ipiEngine.buscar(
            'SELECT * FROM pessoas WHERE LOWER(nome) LIKE ?',
            [`%${nome.toLowerCase()}%`]
        );
    }

    async obterTodasPessoas() {
        return await window.ipiEngine.buscar('SELECT * FROM pessoas');
    }

    // ─── CONFIGURAÇÕES ───

    async definirConfiguracao(chave, valor) {
        const valorSerializado = typeof valor === 'object' && valor !== null
            ? JSON.stringify(valor)
            : valor;
        await window.ipiEngine.salvar('configuracoes', { chave, valor: valorSerializado }, 'chave');
    }

    async obterConfiguracao(chave) {
        const row = await window.ipiEngine.buscarUm(
            'SELECT valor FROM configuracoes WHERE chave = ?',
            [chave]
        );
        if (!row || row.valor === null) return null;
        try {
            return JSON.parse(row.valor);
        } catch {
            return row.valor;
        }
    }

    // ─── ESTATÍSTICAS ───

    async obterEstatisticas() {
        const [
            { values: [totalOcorr] },
            { values: [pendentes] },
            { values: [totalVeic] },
            { values: [totalPess] }
        ] = await Promise.all([
            window.ipiEngine.executar('SELECT COUNT(*) as c FROM ocorrencias'),
            window.ipiEngine.executar('SELECT COUNT(*) as c FROM ocorrencias WHERE sincronizado = 0'),
            window.ipiEngine.executar('SELECT COUNT(*) as c FROM veiculos'),
            window.ipiEngine.executar('SELECT COUNT(*) as c FROM pessoas')
        ]);

        return {
            total: totalOcorr?.c || 0,
            pendentes: pendentes?.c || 0,
            sincronizadas: (totalOcorr?.c || 0) - (pendentes?.c || 0),
            veiculos: totalVeic?.c || 0,
            pessoas: totalPess?.c || 0
        };
    }

    async limparTudo() {
        await Promise.all([
            window.ipiEngine.limpar('ocorrencias'),
            window.ipiEngine.limpar('veiculos'),
            window.ipiEngine.limpar('pessoas'),
            window.ipiEngine.limpar('envolvidos'),
            window.ipiEngine.limpar('veiculos_envolvidos')
        ]);
    }

    // ─── MISSÃO ───

    definirMissao(municipio) {
        return this.definirConfiguracao('missao_municipio', municipio);
    }

    obterMissao() {
        return this.obterConfiguracao('missao_municipio');
    }

    // ─── MAPA OFFLINE (PMTiles) ───

    async salvarMapaOffline(dados) {
        const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(new Blob([dados]));
        });

        await window.ipiEngine.salvar('mapa_offline', {
            id: 'goias',
            dados: base64,
            data_download: new Date().toISOString()
        }, 'id');
    }

    async obterMapaOffline() {
        const row = await window.ipiEngine.buscarUm(
            'SELECT * FROM mapa_offline WHERE id = ?',
            ['goias']
        );
        if (!row) return null;
        return {
            ...row,
            dados: row.dados ? Uint8Array.from(atob(row.dados), c => c.charCodeAt(0)) : null,
            dataDownload: row.data_download
        };
    }

    deletarMapaOffline() {
        return window.ipiEngine.deletar('mapa_offline', 'id', 'goias');
    }

    async temMapaOffline() {
        const row = await window.ipiEngine.buscarUm(
            'SELECT id FROM mapa_offline WHERE id = ?',
            ['goias']
        );
        return !!row;
    }

    async obterTamanhoMapaOffline() {
        const row = await window.ipiEngine.buscarUm(
            'SELECT LENGTH(dados) as tamanho FROM mapa_offline WHERE id = ?',
            ['goias']
        );
        return row ? row.tamanho || 0 : 0;
    }

    // ─── CACHE DA NUVEM ───

    async atualizarCacheNuvem(municipio) {
        if (!window.supabaseClient) throw new Error('Cliente Supabase não inicializado.');

        try {
            let queryV = window.supabaseClient.from('veiculos').select('*');
            let queryP = window.supabaseClient.from('pessoas').select('*');
            if (municipio) {
                queryV = queryV.eq('municipio', municipio);
                queryP = queryP.eq('municipio', municipio);
            }

            const [respV, respP] = await Promise.all([queryV, queryP]);

            if (respV.error) throw respV.error;
            if (respP.error) throw respP.error;

            await Promise.all([
                window.ipiEngine.limpar('veiculos'),
                window.ipiEngine.limpar('pessoas')
            ]);

            for (const v of respV.data) await this.salvarVeiculo(v);
            for (const p of respP.data) await this.salvarPessoa(p);

            console.log(`[DB] Cache atualizado: ${respV.data.length} veículos, ${respP.data.length} pessoas.`);
            return { veiculos: respV.data.length, pessoas: respP.data.length };
        } catch (e) {
            console.error('[DB] Erro ao atualizar cache:', e);
            throw e;
        }
    }
}

window.ipiDB = new IPIDatabase();
