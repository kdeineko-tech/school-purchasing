-- Журнал запитів AI-помічника для SLO-2 операційних вимог PM (ValiaBihun/2026-quitcode-dream-team#83, розділ 1):
-- «частка запитів Suggest lines за добу, після яких користувач бачить пропозицію, а не стан «недоступний»», рядок на
-- запит, без тексту опису, зберігається не менше 35 днів. Журнали Vercel Hobby живуть 1 годину — тому база.
--
-- Рядок — ті самі поля, що й llm.call (src/lib/ai/llm-log.ts): БЕЗ опису, промпту й відповіді моделі — таких колонок
-- немає. Хто питав — лише user_id (auth.uid()), щоб зловживання прямим викликом rpc можна було знайти й прибрати.
-- Профіль видалено — рядок лишається з user_id = null (on delete set null): журнал зберігається 35+ днів, а
-- знаменник SLO-2 за минулі дні не змінюється.
-- Помилки вводу (порожній чи задовгий опис) сюди не пишуться: модель не викликали, це не збій сервісу (SLO-2).
--
-- Строк зберігання: рядки не видаляються ні застосунком, ні cron — тобто «не менше 35 днів» виконується з запасом.
-- Підрахунок SLO-2 — SQL у docs/runbook.md (розділ «SLO-2: AI-помічник»), лише select у SQL Editor.
--
-- Доступ: напряму таблицю не читає й не пише ніхто, крім service_role (revoke all; RLS без політик для anon і
-- authenticated). Запис — лише через rpc log_ai_call: private-функція security definer перевіряє, що виклик від
-- користувача з сесією, і вставляє рядок з user_id = auth.uid() (підробити чужий user_id не можна).

create table public.ai_calls (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references public.profiles (id) on delete set null,
  request_id uuid not null,
  route text not null check (char_length(route) <= 100),
  model text not null check (char_length(model) <= 200),
  fallback_used boolean not null,
  state text not null check (state in ('ok', 'refused', 'injection', 'unavailable')),
  error_kind text check (error_kind in ('no_key', 'rate_limited', 'timeout', 'invalid_output', 'provider_error')),
  latency_ms integer not null check (latency_ms >= 0),
  input_tokens integer check (input_tokens >= 0),
  output_tokens integer check (output_tokens >= 0),
  cost_usd numeric(12, 6) check (cost_usd >= 0),
  prompt_version text not null check (char_length(prompt_version) <= 50),
  -- Код причини — лише для «недоступний»; у відповіді моделі причини немає.
  constraint ai_calls_error_kind_only_unavailable check ((state = 'unavailable') = (error_kind is not null))
);

-- Підрахунок за добу й за 28 днів — діапазон за created_at.
create index ai_calls_created_at_idx on public.ai_calls (created_at);

alter table public.ai_calls enable row level security;
revoke all on table public.ai_calls from anon, authenticated;
grant select, insert, update, delete on table public.ai_calls to service_role;

create or replace function private.log_ai_call(
  p_request_id uuid,
  p_route text,
  p_model text,
  p_fallback_used boolean,
  p_state text,
  p_error_kind text,
  p_latency_ms integer,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_usd numeric,
  p_prompt_version text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  insert into public.ai_calls (
    user_id, request_id, route, model, fallback_used, state, error_kind, latency_ms, input_tokens, output_tokens,
    cost_usd, prompt_version
  )
  values (
    (select auth.uid()), p_request_id, p_route, p_model, p_fallback_used, p_state, p_error_kind, p_latency_ms,
    p_input_tokens, p_output_tokens, p_cost_usd, p_prompt_version
  );
end;
$$;

revoke execute on function private.log_ai_call(uuid, text, text, boolean, text, text, integer, integer, integer, numeric, text)
  from public, anon;
grant execute on function private.log_ai_call(uuid, text, text, boolean, text, text, integer, integer, integer, numeric, text)
  to authenticated;

-- Тонка обгортка для supabase.rpc('log_ai_call'): Data API бачить лише схему public.
create or replace function public.log_ai_call(
  p_request_id uuid,
  p_route text,
  p_model text,
  p_fallback_used boolean,
  p_state text,
  p_error_kind text,
  p_latency_ms integer,
  p_input_tokens integer,
  p_output_tokens integer,
  p_cost_usd numeric,
  p_prompt_version text
)
returns void
language sql
security invoker
set search_path = ''
as $$
  select private.log_ai_call(
    p_request_id, p_route, p_model, p_fallback_used, p_state, p_error_kind, p_latency_ms, p_input_tokens,
    p_output_tokens, p_cost_usd, p_prompt_version
  );
$$;

revoke execute on function public.log_ai_call(uuid, text, text, boolean, text, text, integer, integer, integer, numeric, text)
  from public, anon;
grant execute on function public.log_ai_call(uuid, text, text, boolean, text, text, integer, integer, integer, numeric, text)
  to authenticated;
