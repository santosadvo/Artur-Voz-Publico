-- Contador da cota grátis do Google Cloud Text-to-Speech (Postgres / Supabase).
-- O Google dá por mês 1 milhão de caracteres nas vozes Chirp 3 HD e 4 milhões
-- nas WaveNet; acima disso, cobra. Este contador soma o que o seu sistema
-- mandou em cada voz no mês de cobrança do Google (horário do Pacífico) e só
-- libera um texto se ele couber no limite.

create table if not exists public.voz_uso (
  mes text not null,               -- 'AAAA-MM' no horário do Pacífico
  voz text not null,               -- ex. pt-BR-Chirp3-HD-Algenib
  caracteres bigint not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (mes, voz)
);

alter table public.voz_uso enable row level security;
-- só o servidor (service_role) lê e escreve
grant all on table public.voz_uso to service_role;

-- Reserva atômica: soma p_caracteres só se o total do mês continuar dentro de
-- p_limite. Devolve true quando reservou. Conta antes de chamar o Google
-- (falha também conta): erra para o lado de não cobrar.
create or replace function public.fn_voz_reservar(p_mes text, p_voz text, p_caracteres integer, p_limite bigint)
returns boolean
language plpgsql
set search_path = public
as $$
declare
  ok boolean;
begin
  insert into public.voz_uso (mes, voz) values (p_mes, p_voz) on conflict do nothing;
  update public.voz_uso
     set caracteres = caracteres + p_caracteres, atualizado_em = now()
   where mes = p_mes and voz = p_voz and caracteres + p_caracteres <= p_limite
  returning true into ok;
  return coalesce(ok, false);
end;
$$;

revoke execute on function public.fn_voz_reservar(text, text, integer, bigint) from public, anon, authenticated;
grant execute on function public.fn_voz_reservar(text, text, integer, bigint) to service_role;
