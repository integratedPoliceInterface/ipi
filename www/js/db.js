/**
 * IPI - Serviço de Banco de Dados (SQLite Criptografado)
 * Armazenamento local persistente com criptografia e sincronização via Supabase.
 * Em conformidade com o RNF-001 (Segurança e Sigilo dos Dados Locais).
 */

function _normMunicipio(s) {
    return (s || '').toString().trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function _canonMunicipio(input) {
    if (!input) return null;
    const norm = _normMunicipio(input);
    if (typeof GOIAS_MUNICIPIOS !== 'undefined') {
        for (const [, , nome] of GOIAS_MUNICIPIOS) {
            if (_normMunicipio(nome) === norm) return nome; // retorna nome canônico com acento correto
        }
    }
    // fallback: capitaliza
    return input.trim();
}

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
        // RN-001 (Fase 01 6º período): validação no backend, não só na UI (app.js:salvarRAI)
        if (!ocorrencia.tipo || !String(ocorrencia.tipo).trim()) {
            throw new Error('RN-001: Tipo de ocorrência é obrigatório.');
        }
        if (!ocorrencia.descricao || String(ocorrencia.descricao).trim().length < 10) {
            throw new Error('RN-001: Descrição deve ter no mínimo 10 caracteres.');
        }
        // RN-002: matrícula do operador vinculada automaticamente
        const matricula = (ocorrencia.matricula_operador || '').toString().trim()
            || (window.servicoAuth && window.servicoAuth.obterOperador
                ? window.servicoAuth.obterOperador().matricula : '')
            || 'OPERADOR_DESCONHECIDO';
        const dados = {
            id: ocorrencia.id || `RAI-${Date.now()}`,
            matricula_operador: matricula,
            tipo: ocorrencia.tipo,
            descricao: ocorrencia.descricao,
            latitude: ocorrencia.latitude || null,
            longitude: ocorrencia.longitude || null,
            referencia_endereco: ocorrencia.referencia_endereco || '',
            data_hora: ocorrencia.data_hora || new Date().toISOString(),
            sincronizado: ocorrencia.sincronizado ? 1 : 0,
            modo: ocorrencia.modo || 'NUVEM',
            municipio: ocorrencia.municipio ? _canonMunicipio(ocorrencia.municipio) : null,
            observacoes: ocorrencia.observacoes || ''
        };

        // RN-006: imutabilidade local — não sobrescrever ocorrência já sincronizada
        if (dados.id) {
            const existente = await window.ipiEngine.buscarUm('SELECT sincronizado FROM ocorrencias WHERE id = ?', [dados.id]);
            if (existente && existente.sincronizado === 1) {
                console.warn('[DB] RN-006: Ocorrência já sincronizada, edição bloqueada:', dados.id);
                throw new Error('RN-006: Ocorrência já sincronizada não pode ser editada (integridade jurídica).');
            }
        }

        await window.ipiEngine.salvar('ocorrencias', dados, 'id');

        if (ocorrencia.pessoas && ocorrencia.pessoas.length > 0) {
            for (const p of ocorrencia.pessoas) {
                if (p.cpf || p.nome) {
                    await window.ipiEngine.executar(
                        `INSERT OR IGNORE INTO envolvidos (ocorrencia_id, cpf_pessoa, envolvimento)
                         VALUES (?, ?, ?)`,
                        [dados.id, p.cpf || '', p.envolvimento || 'Suspeito']
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
                        [dados.id, v.placa.toUpperCase()]
                    );
                }
            }
        }
        if (window.ipiEngine.tipo === 'web') await window.ipiEngine._salvarWeb();
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
        if (window.ipiEngine.tipo === 'web') await window.ipiEngine._salvarWeb();
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
        // Busca normalizada: SQLite LIKE não lida com acentos, então filtra em JS quando necessário
        const norm = _normMunicipio(nome);
        const rows = await window.ipiEngine.buscar('SELECT * FROM pessoas');
        if (!norm) return rows;
        return rows.filter(r => _normMunicipio(r.nome).includes(norm) || r.nome.toLowerCase().includes(nome.toLowerCase()));
    }

    async obterTodasPessoas() {
        return await window.ipiEngine.buscar('SELECT * FROM pessoas');
    }

    // ─── POLICIAIS (cache offline) ───

    async salvarPolicial(policial) {
        await window.ipiEngine.salvar('policiais', policial, 'matricula');
    }

    async buscarPolicial(matricula) {
        const row = await window.ipiEngine.buscarUm(
            'SELECT * FROM policiais WHERE matricula = ?',
            [matricula]
        );
        return row || null;
    }

    async obterTodosPoliciais() {
        return await window.ipiEngine.buscar('SELECT * FROM policiais');
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
        // RN-006: não apagar ocorrências sincronizadas sem confirmação explícita
        const total = await window.ipiEngine.buscar('SELECT sincronizado FROM ocorrencias');
        const temSinc = total.some(r => r.sincronizado === 1);
        if (temSinc) console.warn('[DB] RN-006: Limpando ocorrências sincronizadas — ação auditável.');
        await Promise.all([
            window.ipiEngine.limpar('ocorrencias'),
            window.ipiEngine.limpar('veiculos'),
            window.ipiEngine.limpar('pessoas'),
            window.ipiEngine.limpar('envolvidos'),
            window.ipiEngine.limpar('veiculos_envolvidos')
        ]);
    }

    async registrarAuditoriaConsulta(tipo, parametro, modo, encontrado, municipio) {
        const operador = window.servicoAuth ? window.servicoAuth.obterOperador() : null;
        const matricula = operador ? operador.matricula : (localStorage.getItem('ipi_matricula') || 'DESCONHECIDO');
        const registro = { matricula_operador: matricula, tipo_consulta: tipo, parametro, modo: modo || 'DESCONHECIDO', resultado_encontrado: encontrado, municipio: municipio || null };
        // Tenta Supabase, fallback local (configuracoes como log)
        try {
            if (window.supabaseClient && navigator.onLine) {
                await window.supabaseClient.from('auditoria_consultas').insert([registro]);
            }
        } catch (e) { console.warn('[DB] Falha auditoria nuvem:', e.message); }
        try {
            const logs = await this.obterConfiguracao('auditoria_logs') || [];
            logs.push({ ...registro, timestamp: new Date().toISOString() });
            if (logs.length > 500) logs.splice(0, logs.length - 500);
            await this.definirConfiguracao('auditoria_logs', logs);
        } catch {}
    }

    // ─── MISSÃO ───

    definirMissao(municipio) {
        const canon = _canonMunicipio(municipio);
        return this.definirConfiguracao('missao_municipio', canon);
    }

    obterMissao() {
        return this.obterConfiguracao('missao_municipio');
    }

    // ─── MAPA OFFLINE (PMTiles) - IndexedDB primário, SQLite como fallback legado ───

    async salvarMapaOffline(dados) {
        const buf = dados instanceof Uint8Array ? dados : new Uint8Array(dados);
        // Tenta IndexedDB primeiro (evita estouro de localStorage 5MB)
        if (window.mapaStorage && typeof window.mapaStorage.salvarMapaIDB === 'function') {
            try {
                await window.mapaStorage.salvarMapaIDB(buf);
                // Remove legado SQLite se existir para liberar espaço do localStorage
                try { await window.ipiEngine.deletar('mapa_offline', 'id', 'goias'); } catch {}
                console.log('[DB] Mapa salvo em IndexedDB (' + buf.byteLength + ' bytes)');
                return;
            } catch (e) { console.warn('[DB] Falha IndexedDB, fallback SQLite:', e); }
        }
        // Fallback legado: SQLite base64 (compatibilidade)
        const base64 = await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.readAsDataURL(new Blob([buf]));
        });
        await window.ipiEngine.salvar('mapa_offline', {
            id: 'goias',
            dados: base64,
            data_download: new Date().toISOString()
        }, 'id');
    }

    async obterMapaOffline() {
        // Tenta IndexedDB primeiro
        if (window.mapaStorage && typeof window.mapaStorage.obterMapaIDB === 'function') {
            try {
                const idb = await window.mapaStorage.obterMapaIDB();
                if (idb && idb.dados && idb.dados.byteLength > 0) {
                    return { id: 'goias', dados: idb.dados, data_download: idb.dataDownload, dataDownload: idb.dataDownload, origem: 'IDB' };
                }
            } catch (e) { console.warn('[DB] Erro IDB obterMapa:', e); }
        }
        // Fallback SQLite
        const row = await window.ipiEngine.buscarUm(
            'SELECT * FROM mapa_offline WHERE id = ?',
            ['goias']
        );
        if (!row) return null;
        return {
            ...row,
            dados: row.dados ? Uint8Array.from(atob(row.dados), c => c.charCodeAt(0)) : null,
            dataDownload: row.data_download,
            origem: 'SQLITE'
        };
    }

    async deletarMapaOffline() {
        if (window.mapaStorage && typeof window.mapaStorage.deletarMapaIDB === 'function') {
            try { await window.mapaStorage.deletarMapaIDB(); } catch (e) { console.warn('[DB] Erro ao deletar IDB:', e); }
        }
        return window.ipiEngine.deletar('mapa_offline', 'id', 'goias');
    }

    async temMapaOffline() {
        if (window.mapaStorage && typeof window.mapaStorage.temMapaIDB === 'function') {
            try { if (await window.mapaStorage.temMapaIDB()) return true; } catch {}
        }
        const row = await window.ipiEngine.buscarUm(
            'SELECT id FROM mapa_offline WHERE id = ?',
            ['goias']
        );
        return !!row;
    }

    async obterTamanhoMapaOffline() {
        if (window.mapaStorage && typeof window.mapaStorage.obterTamanhoMapaIDB === 'function') {
            try {
                const t = await window.mapaStorage.obterTamanhoMapaIDB();
                if (t > 0) return t;
            } catch {}
        }
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
            const munCanon = municipio ? _canonMunicipio(municipio) : null;
            let queryV = window.supabaseClient.from('veiculos').select('*').neq('situacao', 'REGULAR');
            let queryP = window.supabaseClient.from('pessoas').select('*').neq('situacao', 'REGULAR');
            if (munCanon) {
                queryV = queryV.eq('municipio', munCanon);
                queryP = queryP.eq('municipio', munCanon);
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
