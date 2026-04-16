/**
 * IPI - Serviço de Banco de Dados (IndexedDB)
 * Armazenamento local persistente com sincronização via Supabase.
 */

const DB_NOME = 'ipi_db';
const DB_VERSAO = 1;

const ARMAZENS = {
    OCORRENCIAS: 'ocorrencias',
    VEICULOS:    'veiculos',
    PESSOAS:     'pessoas',
    CONFIGURACOES: 'configuracoes'
};

class IPIDatabase {
    constructor() {
        this.db = null;
    }

    abrir() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NOME, DB_VERSAO);

            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                // Store de Ocorrências
                if (!db.objectStoreNames.contains(ARMAZENS.OCORRENCIAS)) {
                    const store = db.createObjectStore(ARMAZENS.OCORRENCIAS, { keyPath: 'id' });
                    store.createIndex('sincronizado', 'sincronizado', { unique: false });
                    store.createIndex('tipo', 'tipo', { unique: false });
                }
                // Cache de Veículos
                if (!db.objectStoreNames.contains(ARMAZENS.VEICULOS)) {
                    const store = db.createObjectStore(ARMAZENS.VEICULOS, { keyPath: 'placa' });
                    store.createIndex('status', 'status', { unique: false });
                }
                // Cache de Pessoas
                if (!db.objectStoreNames.contains(ARMAZENS.PESSOAS)) {
                    const store = db.createObjectStore(ARMAZENS.PESSOAS, { keyPath: 'cpf' });
                    store.createIndex('status', 'status', { unique: false });
                }
                // Store de Configurações KV
                if (!db.objectStoreNames.contains(ARMAZENS.CONFIGURACOES)) {
                    db.createObjectStore(ARMAZENS.CONFIGURACOES, { keyPath: 'chave' });
                }
            };

            req.onsuccess = (e) => {
                this.db = e.target.result;
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

