/**
 * IPI - SQL Schema para banco local SQLite
 * Corresponde ao modelo documentado no DER do projeto.
 */

var IPI_SCHEMA = `
CREATE TABLE IF NOT EXISTS policiais (
    matricula TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    senha_hash TEXT NOT NULL,
    unidade TEXT DEFAULT 'Batalhão Rural',
    criada_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ocorrencias (
    id TEXT PRIMARY KEY,
    matricula_operador TEXT NOT NULL DEFAULT 'OPERADOR_DESCONHECIDO',
    tipo TEXT NOT NULL,
    descricao TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    referencia_endereco TEXT,
    data_hora TEXT NOT NULL,
    sincronizado INTEGER DEFAULT 0,
    modo TEXT DEFAULT 'NUVEM',
    municipio TEXT,
    observacoes TEXT,
    criada_em TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS veiculos (
    placa TEXT PRIMARY KEY,
    modelo TEXT,
    cor TEXT,
    ano_fabricacao TEXT,
    proprietario TEXT,
    numero_boletim TEXT,
    situacao TEXT DEFAULT 'REGULAR',
    municipio TEXT
);

CREATE TABLE IF NOT EXISTS pessoas (
    cpf TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    data_nascimento TEXT,
    tipo_mandado TEXT,
    observacao TEXT,
    situacao TEXT DEFAULT 'REGULAR',
    municipio TEXT
);

CREATE TABLE IF NOT EXISTS envolvidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ocorrencia_id TEXT NOT NULL,
    cpf_pessoa TEXT NOT NULL,
    envolvimento TEXT DEFAULT 'Suspeito',
    FOREIGN KEY (ocorrencia_id) REFERENCES ocorrencias(id),
    FOREIGN KEY (cpf_pessoa) REFERENCES pessoas(cpf)
);

CREATE TABLE IF NOT EXISTS veiculos_envolvidos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ocorrencia_id TEXT NOT NULL,
    placa_veiculo TEXT NOT NULL,
    FOREIGN KEY (ocorrencia_id) REFERENCES ocorrencias(id),
    FOREIGN KEY (placa_veiculo) REFERENCES veiculos(placa)
);

CREATE TABLE IF NOT EXISTS configuracoes (
    chave TEXT PRIMARY KEY,
    valor TEXT
);

CREATE TABLE IF NOT EXISTS mapa_offline (
    id TEXT PRIMARY KEY,
    dados BLOB,
    data_download TEXT
);
`;

async function inicializarSchema() {
    const sql = IPI_SCHEMA.split(';').filter(s => s.trim().length > 0);
    for (const stmt of sql) {
        await window.ipiEngine.executar(stmt.trim() + ';');
    }
    console.log('[Schema] Banco SQLite inicializado com sucesso.');
}

window.inicializarSchema = inicializarSchema;
