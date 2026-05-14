/**
 * IPI - Serviço de Banco de Dados (IndexedDB)
 * Armazenamento local persistente com sincronização via Supabase.
 */

const DB_NOME = 'ipi_db';

const ARMAZENS = {
    OCORRENCIAS: 'ocorrencias',
    VEICULOS:    'veiculos',
    PESSOAS:     'pessoas',
    CONFIGURACOES: 'configuracoes'
};

const _SCHEMA = {
    ocorrencias:    { keyPath: 'id', indexes: ['sincronizado', 'tipo'] },
    veiculos:       { keyPath: 'placa', indexes: ['status'] },
    pessoas:        { keyPath: 'cpf', indexes: ['status'] },
    configuracoes:  { keyPath: 'chave', indexes: [] }
};

class IPIDatabase {
    constructor() {
        this.db = null;
    }

    abrir() {
        return this._abrirVersao(0);
    }

    _abrirVersao(versao) {
        return new Promise((resolve, reject) => {
            const req = versao === 0 ? indexedDB.open(DB_NOME) : indexedDB.open(DB_NOME, versao);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                for (const [nome, cfg] of Object.entries(_SCHEMA)) {
                    if (!db.objectStoreNames.contains(nome)) {
                        const st = db.createObjectStore(nome, { keyPath: cfg.keyPath });
                        for (const idx of cfg.indexes) {
                            st.createIndex(idx, idx, { unique: false });
                        }
                    }
                }
            };

            req.onsuccess = (e) => {
                const db = e.target.result;
                if (versao === 0) {
                    const precisaUpgrade = Object.keys(_SCHEMA).some(n => !db.objectStoreNames.contains(n));
                    if (precisaUpgrade) {
                        const novaVersao = db.version + 1;
                        db.close();
                        resolve(this._abrirVersao(novaVersao));
                        return;
                    }
                }
                this.db = db;
                resolve(this.db);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    }

    // ─── Auxiliares Genéricos ───
    _transacao(armazem, modo) {
        return this.db.transaction([armazem], modo).objectStore(armazem);
    }

    _salvar(nomeArmazem, obj) {
        return new Promise((res, rej) => {
            const req = this._transacao(nomeArmazem, 'readwrite').put(obj);
            req.onsuccess = () => res(obj);
            req.onerror  = (e) => rej(e.target.error);
        });
    }

    _obterTodos(nomeArmazem) {
        return new Promise((res, rej) => {
            const req = this._transacao(nomeArmazem, 'readonly').getAll();
            req.onsuccess = (e) => res(e.target.result);
            req.onerror   = (e) => rej(e.target.error);
        });
    }

    _obter(nomeArmazem, chave) {
        return new Promise((res, rej) => {
            const req = this._transacao(nomeArmazem, 'readonly').get(chave);
            req.onsuccess = (e) => res(e.target.result || null);
            req.onerror   = (e) => rej(e.target.error);
        });
    }

    _deletar(nomeArmazem, chave) {
        return new Promise((res, rej) => {
            const req = this._transacao(nomeArmazem, 'readwrite').delete(chave);
            req.onsuccess = () => res();
            req.onerror   = (e) => rej(e.target.error);
        });
    }

    _limpar(nomeArmazem) {
        return new Promise((res, rej) => {
            const req = this._transacao(nomeArmazem, 'readwrite').clear();
            req.onsuccess = () => res();
            req.onerror   = (e) => rej(e.target.error);
        });
    }

    // ─── OCORRÊNCIAS ───
    salvarOcorrencia(ocorrencia) {
        return this._salvar(ARMAZENS.OCORRENCIAS, ocorrencia);
    }
    obterTodasOcorrencias() {
        return this._obterTodos(ARMAZENS.OCORRENCIAS);
    }
    async obterOcorrenciasPendentes() {
        const todas = await this.obterTodasOcorrencias();
        return todas.filter(o => !o.sincronizado);
    }
    marcarSincronizada(id) {
        return this._obter(ARMAZENS.OCORRENCIAS, id).then(o => {
            if (!o) return null;
            o.sincronizado = true;
            return this._salvar(ARMAZENS.OCORRENCIAS, o);
        });
    }

    // ─── VEÍCULOS ───
    salvarVeiculo(veiculo) {
        return this._salvar(ARMAZENS.VEICULOS, veiculo);
    }
    buscarVeiculo(placa) {
        return this._obter(ARMAZENS.VEICULOS, placa.toUpperCase());
    }
    obterTodosVeiculos() {
        return this._obterTodos(ARMAZENS.VEICULOS);
    }

    // ─── PESSOAS ───
    salvarPessoa(pessoa) {
        return this._salvar(ARMAZENS.PESSOAS, pessoa);
    }
    buscarPessoaPorCPF(cpf) {
        return this._obter(ARMAZENS.PESSOAS, cpf);
    }
    async buscarPessoaPorNome(nome) {
        const todas = await this._obterTodos(ARMAZENS.PESSOAS);
        const q = nome.toLowerCase();
        return todas.filter(p => p.nome.toLowerCase().includes(q));
    }
    obterTodasPessoas() {
        return this._obterTodos(ARMAZENS.PESSOAS);
    }

    // ─── CONFIGURAÇÕES ───
    definirConfiguracao(chave, valor) {
        return this._salvar(ARMAZENS.CONFIGURACOES, { chave, valor });
    }
    async obterConfiguracao(chave) {
        const resultado = await this._obter(ARMAZENS.CONFIGURACOES, chave);
        return resultado ? resultado.valor : null;
    }

    // ─── ESTATÍSTICAS ───
    async obterEstatisticas() {
        const [ocorrencias, veiculos, pessoas] = await Promise.all([
            this.obterTodasOcorrencias(),
            this.obterTodosVeiculos(),
            this.obterTodasPessoas()
        ]);
        return {
            total:    ocorrencias.length,
            pendentes: ocorrencias.filter(o => !o.sincronizado).length,
            sincronizadas: ocorrencias.filter(o => o.sincronizado).length,
            veiculos: veiculos.length,
            pessoas:  pessoas.length
        };
    }

    async limparTudo() {
        await Promise.all([
            this._limpar(ARMAZENS.OCORRENCIAS),
            this._limpar(ARMAZENS.VEICULOS),
            this._limpar(ARMAZENS.PESSOAS)
        ]);
    }

    async atualizarCacheNuvem() {
        if (!window.supabaseClient) throw new Error('Cliente Supabase não inicializado.');

        try {
            console.log('[DB] Iniciando atualização de cache da nuvem...');
            
            // 1. Buscar dados reais
            const [respV, respP] = await Promise.all([
                window.supabaseClient.from('veiculos').select('*'),
                window.supabaseClient.from('pessoas').select('*')
            ]);

            if (respV.error) throw respV.error;
            if (respP.error) throw respP.error;

            // 2. Limpar cache atual
            await Promise.all([
                this._limpar(ARMAZENS.VEICULOS),
                this._limpar(ARMAZENS.PESSOAS)
            ]);

            // 3. Salvar novos dados
            const promises = [];
            for (const v of respV.data) promises.push(this.salvarVeiculo(v));
            for (const p of respP.data) promises.push(this.salvarPessoa(p));
            
            await Promise.all(promises);
            
            console.log(`[DB] Cache atualizado: ${respV.data.length} veículos, ${respP.data.length} pessoas.`);
            return { veiculos: respV.data.length, pessoas: respP.data.length };
        } catch (e) {
            console.error('[DB] Erro ao atualizar cache:', e);
            throw e;
        }
    }
}

// Singleton Global
window.ipiDB = new IPIDatabase();

