/**
 * IPI - SQLite Database Engine
 * Motor de banco SQLite com suporte a criptografia.
 * Usa sql.js (Web) ou @capacitor-community/sqlite (Android/iOS).
 */

var DB_NOME = 'ipi_db';
var DB_CHAVE = 'ipi-crypt-key-v1';

let engine = null;

async function detectPlatform() {
    if (typeof Capacitor !== 'undefined' && Capacitor.isNativePlatform()) {
        try {
            const { CapacitorSQLite, SQLiteDBConnection } = await import(
                '@capacitor-community/sqlite'
            );
            return 'native';
        } catch {
            return 'web';
        }
    }
    return 'web';
}

function gerarChaveDerivada(senha) {
    const encoder = new TextEncoder();
    const data = encoder.encode(senha + ':ipi:sqlcipher:v1');
    return crypto.subtle.digest('SHA-256', data).then(hash => {
        const hex = Array.from(new Uint8Array(hash))
            .map(b => b.toString(16).padStart(2, '0')).join('');
        return hex.substring(0, 64);
    });
}

class SQLEngine {
    constructor() {
        this.db = null;
        this.tipo = 'web';
        this.chave = null;
    }

    async abrir(senhaMestre) {
        this.tipo = await detectPlatform();
        this.chave = senhaMestre || 'ipi_default';

        if (this.tipo === 'native') {
            await this._abrirNative();
        } else {
            await this._abrirWeb();
        }
    }

    async _abrirWeb() {
        if (typeof initSqlJs === 'undefined') {
            throw new Error('sql.js não carregado. Inclua o script sql-wasm.js.');
        }
        const SQL = await initSqlJs({ locateFile: file => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${file}` });
        const chaveDerivada = await gerarChaveDerivada(this.chave);
        const dadosCripto = localStorage.getItem(DB_CHAVE);

        if (dadosCripto) {
            const iv = new Uint8Array(16);
            const salt = new Uint8Array(16);
            const encrypted = Uint8Array.from(atob(dadosCripto), c => c.charCodeAt(0));
            salt.set(encrypted.subarray(0, 16));
            iv.set(encrypted.subarray(16, 32));
            const ciphertext = encrypted.subarray(32);

            const keyMaterial = await crypto.subtle.importKey(
                'raw', new TextEncoder().encode(chaveDerivada),
                { name: 'PBKDF2' }, false, ['deriveKey']
            );
            const key = await crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
                keyMaterial, { name: 'AES-CBC', length: 256 }, false, ['decrypt']
            );
            try {
                const decrypted = await crypto.subtle.decrypt(
                    { name: 'AES-CBC', iv }, key, ciphertext
                );
                this.db = new SQL.Database(new Uint8Array(decrypted));
            } catch {
                this.db = new SQL.Database();
            }
        } else {
            this.db = new SQL.Database();
        }
    }

    async _salvarWeb() {
        if (!this.db || this.tipo !== 'web') return;
        const dados = this.db.export();

        try {
            const chaveDerivada = await gerarChaveDerivada(this.chave);
            const salt = crypto.getRandomValues(new Uint8Array(16));
            const iv = crypto.getRandomValues(new Uint8Array(16));

            const keyMaterial = await crypto.subtle.importKey(
                'raw', new TextEncoder().encode(chaveDerivada),
                { name: 'PBKDF2' }, false, ['deriveKey']
            );
            const key = await crypto.subtle.deriveKey(
                { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
                keyMaterial, { name: 'AES-CBC', length: 256 }, false, ['encrypt']
            );
            const encrypted = await crypto.subtle.encrypt(
                { name: 'AES-CBC', iv }, key, dados
            );
            const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
            combined.set(salt, 0);
            combined.set(iv, salt.length);
            combined.set(new Uint8Array(encrypted), salt.length + iv.length);
            localStorage.setItem(DB_CHAVE, btoa(String.fromCharCode(...combined)));
        } catch (e) {
            console.warn('[DB-Engine] Erro ao criptografar banco:', e);
        }
    }

    async _abrirNative() {
        const { CapacitorSQLite } = await import('@capacitor-community/sqlite');
        const chaveDerivada = await gerarChaveDerivada(this.chave);

        const info = await CapacitorSQLite.open({
            database: DB_NOME,
            password: chaveDerivada,
            version: 1,
            readonly: false
        });
        this.db = CapacitorSQLite;
        if (!info.result) throw new Error('Falha ao abrir SQLite nativo');
    }

    async executar(sql, params = []) {
        if (this.tipo === 'native') {
            const res = await this.db.execute({
                database: DB_NOME,
                statement: sql,
                values: params
            });
            return res;
        }
        if (params.length > 0) {
            const stmt = this.db.prepare(sql);
            stmt.bind(params);
            const results = [];
            while (stmt.step()) {
                results.push(stmt.getAsObject());
            }
            stmt.free();
            return { values: results, changes: { changes: this.db.getRowsModified() } };
        }
        const results = this.db.exec(sql);
        const values = results.length > 0 ? results[0].values.map(row => {
            const obj = {};
            results[0].columns.forEach((col, i) => { obj[col] = row[i]; });
            return obj;
        }) : [];
        return { values, changes: { changes: this.db.getRowsModified() } };
    }

    async executarMuitos(sql, rows) {
        if (this.tipo === 'native') {
            for (const row of rows) {
                await this.executar(sql, Object.values(row));
            }
            return;
        }
        this.db.run('BEGIN TRANSACTION');
        try {
            const stmt = this.db.prepare(sql);
            for (const row of rows) {
                stmt.run(Object.values(row));
            }
            stmt.free();
            this.db.run('COMMIT');
        } catch (e) {
            this.db.run('ROLLBACK');
            throw e;
        }
    }

    async buscar(sql, params = []) {
        const res = await this.executar(sql, params);
        return res.values || [];
    }

    async buscarUm(sql, params = []) {
        const rows = await this.buscar(sql, params);
        return rows.length > 0 ? rows[0] : null;
    }

    async salvar(tabela, dados, chavePrimaria) {
        const colunas = Object.keys(dados);
        const valores = Object.values(dados);
        const placeholders = colunas.map(() => '?').join(', ');
        const updates = colunas.map(c => `${c} = ?`).join(', ');

        const sql = `INSERT INTO ${tabela} (${colunas.join(', ')})
                     VALUES (${placeholders})
                     ON CONFLICT(${chavePrimaria})
                     DO UPDATE SET ${updates}`;

        const params = [...valores, ...valores];
        await this.executar(sql, params);
        if (this.tipo === 'web') await this._salvarWeb();
    }

    async deletar(tabela, coluna, valor) {
        await this.executar(`DELETE FROM ${tabela} WHERE ${coluna} = ?`, [valor]);
        if (this.tipo === 'web') await this._salvarWeb();
    }

    async limpar(tabela) {
        await this.executar(`DELETE FROM ${tabela}`);
        if (this.tipo === 'web') await this._salvarWeb();
    }

    async rechavear(novaSenha) {
        if (this.tipo === 'web') {
            await this._salvarWeb();
            this.chave = novaSenha;
            const dadosCripto = localStorage.getItem(DB_CHAVE);
            if (dadosCripto) {
                localStorage.removeItem(DB_CHAVE);
            }
            await this._salvarWeb();
            console.log('[DB-Engine] Chave de criptografia atualizada.');
        } else {
            const chaveDerivada = await gerarChaveDerivada(novaSenha);
            await this.db.changePassword({
                database: DB_NOME,
                password: chaveDerivada
            });
            this.chave = novaSenha;
        }
    }

    async fechar() {
        if (this.tipo === 'web') {
            await this._salvarWeb();
            if (this.db) this.db.close();
        } else {
            await this.db.close({ database: DB_NOME });
        }
        this.db = null;
    }

    async obterTamanho() {
        if (this.tipo === 'web') {
            return this.db ? this.db.export().length : 0;
        }
        return 0;
    }
}

window.ipiEngine = new SQLEngine();
