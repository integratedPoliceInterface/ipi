-- IPI - Schema inicial Supabase
-- Tabelas conforme www/js/db-schema.js

create table if not exists policiais (
    matricula text primary key,
    nome text not null,
    senha_hash text not null,
    unidade text default 'Batalhão Rural',
    criada_em timestamptz default now()
);

create table if not exists ocorrencias (
    id text primary key,
    matricula_operador text not null default 'OPERADOR_DESCONHECIDO',
    tipo text not null,
    descricao text not null,
    latitude double precision,
    longitude double precision,
    referencia_endereco text,
    data_hora timestamptz not null,
    sincronizado integer default 0,
    modo text default 'NUVEM',
    municipio text,
    observacoes text,
    criada_em timestamptz default now()
);

create table if not exists veiculos (
    placa text primary key,
    modelo text,
    cor text,
    ano_fabricacao text,
    proprietario text,
    numero_boletim text,
    situacao text default 'REGULAR',
    municipio text
);

create table if not exists pessoas (
    cpf text primary key,
    nome text not null,
    data_nascimento text,
    tipo_mandado text,
    observacao text,
    situacao text default 'REGULAR',
    municipio text
);

create table if not exists envolvidos (
    id bigserial primary key,
    ocorrencia_id text not null references ocorrencias(id) on delete cascade,
    cpf_pessoa text not null references pessoas(cpf) on delete cascade,
    envolvimento text default 'Suspeito'
);

create table if not exists veiculos_envolvidos (
    id bigserial primary key,
    ocorrencia_id text not null references ocorrencias(id) on delete cascade,
    placa_veiculo text not null references veiculos(placa) on delete cascade
);

-- índices para performance
create index if not exists idx_ocorrencias_municipio on ocorrencias(municipio);
create index if not exists idx_ocorrencias_matricula on ocorrencias(matricula_operador);
create index if not exists idx_ocorrencias_data on ocorrencias(data_hora desc);
create index if not exists idx_veiculos_situacao on veiculos(situacao);
create index if not exists idx_pessoas_situacao on pessoas(situacao);
create index if not exists idx_pessoas_nome on pessoas using gin (nome gin_trgm_ops);
create extension if not exists pg_trgm;
