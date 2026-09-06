-- RN-006: Integridade de Registro - ocorrência sincronizada não pode ser editada
-- Implementa imutabilidade jurídica: após sincronizada, bloqueia UPDATE/DELETE

-- Função que impede alteração de ocorrências já sincronizadas
create or replace function prevenir_edicao_ocorrencia_sincronizada()
returns trigger as $$
begin
  if OLD.sincronizado = 1 then
    raise exception 'RN-006: Ocorrência % já sincronizada não pode ser editada ou excluída (integridade jurídica)', OLD.id;
  end if;
  -- também impede que alguém marque como não-sincronizada novamente sem auditoria
  if TG_OP = 'UPDATE' and NEW.sincronizado = 0 and OLD.sincronizado = 1 then
    raise exception 'RN-006: Não é permitido reverter sincronização da ocorrência %', OLD.id;
  end if;
  return NEW;
end;
$$ language plpgsql;

drop trigger if exists trg_imutabilidade_ocorrencia on ocorrencias;
create trigger trg_imutabilidade_ocorrencia
  before update or delete on ocorrencias
  for each row execute function prevenir_edicao_ocorrencia_sincronizada();

-- Auditoria: tabela de logs para todas as consultas (RNF-001 / §20.4)
create table if not exists auditoria_consultas (
  id bigserial primary key,
  matricula_operador text,
  tipo_consulta text not null, -- VEICULO | PESSOA
  parametro text not null,
  modo text not null, -- NUVEM | SMS | BLACKOUT
  resultado_encontrado boolean default false,
  timestamp timestamptz default now(),
  municipio text
);
alter table auditoria_consultas enable row level security;
drop policy if exists "auditoria_all" on auditoria_consultas;
create policy "auditoria_all" on auditoria_consultas for all using (true) with check (true);
create index if not exists idx_auditoria_matricula on auditoria_consultas(matricula_operador);
create index if not exists idx_auditoria_data on auditoria_consultas(timestamp desc);
