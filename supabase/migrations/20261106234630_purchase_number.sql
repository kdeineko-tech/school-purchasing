-- Номер заявки (impl-decision-history, задача 1.1; AC-HIST-01). Застосовані міграції не змінюємо:
-- private.submit_purchase замінюємо цілком (create or replace) — та сама сигнатура, ті самі перевірки й коди помилок;
-- перевірки й запис рядків винесено в private.insert_purchase_lines, щоб повторне подання (задача 4) їх не дублювало.
-- Обгортка public.submit_purchase і її grants лишаються з 20261025185729_purchases.sql.

-- 1. Лічильник: один рядок у схемі private (поза Data API). Номер видає лише submit_purchase через
--    update … returning: рядок заблоковано до кінця транзакції, тож одночасні подання йдуть по черзі, а невдале
--    подання відкочує й лічильник — без пропусків (послідовність Postgres не відкочується). Лічильник лише зростає,
--    тож номер не повторюється навіть після видалення заявки.
create table private.purchase_counter (
  id          boolean primary key default true check (id),
  last_number integer not null check (last_number >= 0)
);

alter table private.purchase_counter enable row level security;
revoke all on table private.purchase_counter from public, anon, authenticated;

-- 2. Номери наявних заявок — за датою подання, найстаріша PUR-1 (#73); рівні created_at розводить id.
alter table public.purchases add column number integer;

update public.purchases as p
set number = n.rn
from (
  select id, row_number() over (order by created_at, id) as rn
  from public.purchases
) as n
where n.id = p.id;

alter table public.purchases
  alter column number set not null,
  add constraint purchases_number_key unique (number),
  add constraint purchases_number_check check (number >= 1);

insert into private.purchase_counter (last_number)
select coalesce(max(number), 0) from public.purchases;

-- 3. Рядки заявки: перевірки NO_LINES, LINE_FIELDS, INVALID_LINE зі зрізу 2 без змін (AC-FRM-06, AC-FRM-15) і insert
--    з ordinality для position. Викликають лише функції security definer — прямого виклику немає ні в кого.
create or replace function private.insert_purchase_lines(p_purchase_id uuid, p_lines jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- «Порожні» символи — рівно ті, що прибирає String.prototype.trim() у формі (див. 20261026100553).
  v_blank constant text := chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(32) || chr(160) || chr(5760) ||
    chr(8192) || chr(8193) || chr(8194) || chr(8195) || chr(8196) || chr(8197) || chr(8198) || chr(8199) ||
    chr(8200) || chr(8201) || chr(8202) || chr(8232) || chr(8233) || chr(8239) || chr(8287) || chr(12288) ||
    chr(65279);
begin
  -- Окремі послідовні перевірки — порядок частин AND PostgreSQL не гарантує (AC-FRM-06).
  if jsonb_typeof(p_lines) is distinct from 'array' then
    raise exception 'NO_LINES';
  end if;
  if jsonb_array_length(p_lines) = 0 then
    raise exception 'NO_LINES';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_lines) as line(value)
    where jsonb_typeof(line.value) is distinct from 'object'
  ) then
    raise exception 'NO_LINES';
  end if;

  -- Усі чотири поля рядка обов'язкові (AC-FRM-15).
  if exists (
    select 1 from jsonb_array_elements(p_lines) as line(value)
    where nullif(btrim(line.value ->> 'name', v_blank), '') is null
       or nullif(btrim(line.value ->> 'purpose', v_blank), '') is null
       or nullif(btrim(line.value ->> 'quantity', v_blank), '') is null
       or nullif(btrim(line.value ->> 'unit_price', v_blank), '') is null
  ) then
    raise exception 'LINE_FIELDS';
  end if;

  -- Значення, що не приводяться до типу колонки, — помилка форми INVALID_LINE, а не помилка бази.
  begin
    insert into public.purchase_lines (purchase_id, position, name, purpose, quantity, unit_price)
    select
      p_purchase_id,
      line.position,
      nullif(btrim(line.value ->> 'name', v_blank), ''),
      nullif(btrim(line.value ->> 'purpose', v_blank), ''),
      nullif(btrim(line.value ->> 'quantity', v_blank), '')::integer,
      nullif(btrim(line.value ->> 'unit_price', v_blank), '')::numeric(12, 2)
    from jsonb_array_elements(p_lines) with ordinality as line(value, position);
  exception
    when invalid_text_representation or numeric_value_out_of_range then
      raise exception 'INVALID_LINE';
  end;
end;
$$;

revoke execute on function private.insert_purchase_lines(uuid, jsonb) from public, anon, authenticated;

-- 4. Подання: перевірки входу, відділу й типу — дослівно як у 20261026100553; далі номер, заявка, рядки.
--    Будь-який виняток (зокрема з insert_purchase_lines) скасовує всю функцію: ні заявки, ні зміни лічильника.
create or replace function private.submit_purchase(p_department_id uuid, p_purchase_type text, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_number integer;
  v_purchase_id uuid;
begin
  -- Працівник, який увійшов і активний (AC-ORG-12).
  if v_uid is null or not private.is_active_user() then
    raise exception 'FORBIDDEN';
  end if;
  v_role := private.current_app_role();

  -- Відділ: адміністратор — будь-який наявний (AC-ORG-22, AC-ORG-29); інші — лише де заявник (AC-FRM-02).
  if not exists (select 1 from public.departments as d where d.id = p_department_id) then
    raise exception 'FORBIDDEN';
  end if;
  if v_role is distinct from 'admin' and not exists (
    select 1 from public.department_members as m
    where m.profile_id = v_uid and m.department_id = p_department_id
  ) then
    raise exception 'FORBIDDEN';
  end if;

  -- Тип: «Самостійна закупівля» — адміністратору або з дозволом (AC-FRM-04, AC-ORG-23).
  if p_purchase_type is null or p_purchase_type not in ('purchasing_department', 'self_purchase') then
    raise exception 'FORBIDDEN';
  end if;
  if p_purchase_type = 'self_purchase' and v_role is distinct from 'admin' and not exists (
    select 1 from public.profiles as p where p.id = v_uid and p.can_self_purchase
  ) then
    raise exception 'FORBIDDEN';
  end if;

  -- Наскрізний номер (AC-HIST-01).
  update private.purchase_counter
  set last_number = last_number + 1
  where id
  returning last_number into v_number;

  -- Наявність схвалювача не перевіряємо: заявка чекає (AC-FRM-12, AC-FRM-13).
  insert into public.purchases (author_id, department_id, purchase_type, number)
  values (v_uid, p_department_id, p_purchase_type, v_number)
  returning id into v_purchase_id;

  perform private.insert_purchase_lines(v_purchase_id, p_lines);

  return v_purchase_id;
end;
$$;
