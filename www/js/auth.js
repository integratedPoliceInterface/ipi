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
        try {
            const { data, error } = await window.supabaseClient
                .from('policiais')
                .select('*')
                .eq('matricula', matricula)
                .maybeSingle();

            if (error || !data) return null;

            const [salt, hash] = data.senha_hash.split(':');
            const senhaDerivada = await this._derivarSenha(senha, salt);

            if (senhaDerivada !== hash) return null;

            this._sessao = {
                matricula: data.matricula,
                nome: data.nome,
                loginAt: new Date().toISOString()
            };

            localStorage.setItem('ipi_matricula', data.matricula);
            await window.ipiDB.definirConfiguracao('sessao', this._sessao);
            return this._sessao;
        } catch (e) {
            console.error('[Auth] Erro no login:', e);
            return null;
        }
    }

    async redefinirSenha(matricula, novaSenha) {
        if (!matricula || !novaSenha || novaSenha.length < 4) {
            throw new Error('Senha deve ter no mínimo 4 caracteres.');
        }
        var senha_hash = await window.gerarHashSenha(novaSenha);
        var { data, error } = await window.supabaseClient
            .from('policiais')
            .update({ senha_hash })
            .eq('matricula', matricula)
            .select()
            .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error('Matrícula não encontrada.');
        return data;
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
