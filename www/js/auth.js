class ServicoAuth {
    constructor() {
        this._sessao = null;
    }

    async verificarSessao() {
        const valor = await window.ipiDB.obterConfiguracao('sessao');
        if (valor && valor.matricula) {
            this._sessao = valor;
            return this._sessao;
        }
        return null;
    }

    async login(matricula, senha) {
        // Tenta Supabase primeiro (quando online), faz fallback para cache local offline
        let registro = null;
        let origem = null;
        try {
            if (window.supabaseClient) {
                const { data, error } = await window.supabaseClient
                    .from('policiais')
                    .select('*')
                    .eq('matricula', matricula)
                    .maybeSingle();
                if (!error && data) {
                    registro = data;
                    origem = 'NUVEM';
                    // Atualiza cache local para login offline futuro
                    try { await window.ipiDB.salvarPolicial({ matricula: data.matricula, nome: data.nome, senha_hash: data.senha_hash, unidade: data.unidade || 'Batalhão Rural' }); } catch {}
                }
            }
        } catch (e) {
            console.warn('[Auth] Falha consulta Supabase, tentando cache local:', e.message);
        }
        // Fallback local se não encontrou na nuvem (offline ou erro)
        if (!registro) {
            try {
                registro = await window.ipiDB.buscarPolicial(matricula);
                if (registro) origem = 'LOCAL';
            } catch (e) {
                console.error('[Auth] Erro ao buscar policial local:', e);
            }
        }

        if (!registro) return null;

        const partes = (registro.senha_hash || '').split(':');
        if (partes.length !== 2) return null;
        const [salt, hash] = partes;
        const senhaDerivada = await this._derivarSenha(senha, salt);
        if (senhaDerivada !== hash) return null;

        this._sessao = {
            matricula: registro.matricula,
            nome: registro.nome,
            loginAt: new Date().toISOString(),
            origem
        };

        localStorage.setItem('ipi_matricula', registro.matricula);
        await window.ipiDB.definirConfiguracao('sessao', this._sessao);
        console.log(`[Auth] Login OK (${origem}) para ${matricula}`);
        return this._sessao;
    }

    async redefinirSenha(matricula, novaSenha) {
        if (!matricula || !novaSenha || novaSenha.length < 4) {
            throw new Error('Senha deve ter no mínimo 4 caracteres.');
        }
        var senha_hash = await window.gerarHashSenha(novaSenha);
        // Se estiver online, atualiza na nuvem
        if (window.supabaseClient && navigator.onLine) {
            try {
                var { data, error } = await window.supabaseClient
                    .from('policiais')
                    .update({ senha_hash })
                    .eq('matricula', matricula)
                    .select()
                    .maybeSingle();
                if (!error && data) {
                    try { await window.ipiDB.salvarPolicial({ matricula, nome: data.nome, senha_hash, unidade: data.unidade }); } catch {}
                    return data;
                }
                if (error) throw error;
            } catch (e) {
                console.warn('[Auth] Falha ao redefinir senha na nuvem, tentando local:', e.message);
            }
        }
        // Fallback offline: atualiza cache local
        var local = await window.ipiDB.buscarPolicial(matricula);
        if (!local) throw new Error('Matrícula não encontrada (offline).');
        await window.ipiDB.salvarPolicial({ matricula, nome: local.nome, senha_hash, unidade: local.unidade });
        console.log('[Auth] Senha redefinida localmente (sincronizará quando online).');
        // Marca para sincronizar quando voltar: guarda pendência
        try { await window.ipiDB.definirConfiguracao('pendente_senha_' + matricula, senha_hash); } catch {}
        return { matricula, nome: local.nome, senha_hash };
    }

    async logout() {
        this._sessao = null;
        localStorage.removeItem('ipi_matricula');
        await window.ipiDB.definirConfiguracao('sessao', null);
    }

    obterOperador() {
        return this._sessao;
    }

    async _derivarSenha(senha, saltBase64) {
        const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw', encoder.encode(senha), { name: 'PBKDF2' }, false, ['deriveBits']
        );
        const bits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
            key, 256
        );
        const hashArray = new Uint8Array(bits);
        return btoa(String.fromCharCode(...hashArray));
    }
}

window.servicoAuth = new ServicoAuth();
