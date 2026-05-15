async function gerarHashSenha(senha) {
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const saltB64 = btoa(String.fromCharCode(...salt));
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw', encoder.encode(senha), { name: 'PBKDF2' }, false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
        { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
        key, 256
    );
    const hashArray = new Uint8Array(bits);
    const hashB64 = btoa(String.fromCharCode(...hashArray));
    return `${saltB64}:${hashB64}`;
}

async function seedPolicial(matricula, nome, senha) {
    const senha_hash = await gerarHashSenha(senha);
    const { data, error } = await window.supabaseClient
        .from('policiais')
        .upsert({ matricula, nome, senha_hash }, { onConflict: 'matricula' })
        .select()
        .single();
    if (error) {
        console.error('[Seed] Erro ao criar policial:', error);
        return null;
    }
    console.log(`[Seed] Policial ${matricula} (${nome}) criado com sucesso.`);
    return data;
}

window.gerarHashSenha = gerarHashSenha;
window.seedPolicial = seedPolicial;
