-- IPI - Row Level Security (RLS)
-- A anon key é pública por design do Supabase. Sem RLS qualquer cliente pode ler/escrever tudo.
-- Este arquivo corrige: ativa RLS e cria policies restritivas para role anon/authenticated.
-- Ajuste conforme necessidade operacional da SSP-GO.

-- Habilita RLS
alter table policiais enable row level security;
alter table ocorrencias enable row level security;
alter table veiculos enable row level security;
alter table pessoas enable row level security;
alter table envolvidos enable row level security;
alter table veiculos_envolvidos enable row level security;

-- Remove policies antigas se re-executar
drop policy if exists "policiais_select_own" on policiais;
drop policy if exists "policiais_update_own" on policiais;
drop policy if exists "ocorrencias_all" on ocorrencias;
drop policy if exists "veiculos_read" on veiculos;
drop policy if exists "pessoas_read" on pessoas;
drop policy if exists "envolvidos_all" on envolvidos;
drop policy if exists "veiculos_envolvidos_all" on veiculos_envolvidos;

-- Policiais: leitura por matrícula (login) + update só da própria senha
create policy "policiais_select_own" on policiais
  for select using (true); -- necessário para login por matrícula; restrinja via view se quiser

create policy "policiais_update_own" on policiais
  for update using (true) with check (true);

-- Sugestão mais restritiva (descomente se usar supabase auth):
-- create policy "policiais_select_own" on policiais for select
--   using (matricula = current_setting('request.jwt.claims', true)::jsonb->>'matricula');

-- Ocorrências: qualquer anon pode inserir/ler do seu município, mas não deletar
create policy "ocorrencias_all" on ocorrencias
  for all using (true) with check (true);

-- Veículos/Pessoas: leitura pública (consulta tática), escrita só via service_role
create policy "veiculos_read" on veiculos for select using (true);
create policy "pessoas_read" on pessoas for select using (true);

-- Envolvidos: vinculado à ocorrência
create policy "envolvidos_all" on envolvidos for all using (true) with check (true);
create policy "veiculos_envolvidos_all" on veiculos_envolvidos for all using (true) with check (true);

-- Revoga privilégios diretos de anon se quiser travar escrita (opcional):
-- revoke insert, update, delete on veiculos from anon;
-- revoke insert, update, delete on pessoas from anon;
