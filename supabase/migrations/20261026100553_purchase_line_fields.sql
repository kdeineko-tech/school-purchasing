-- Обов'язкові поля рядка закупівлі (impl-add-purchase-flow, задача 4.1; AC-FRM-15). Застосовану міграцію
-- 20261025185729_purchases.sql не змінюємо: функцію private.submit_purchase замінюємо цілком (create or replace) — та
-- сама сигнатура, ті самі перевірки й запис, плюс перевірка LINE_FIELDS після перевірок масиву рядків і до insert;
-- поля рядка обрізаються одним набором «порожніх» символів (v_blank) і в перевірці, і під час запису.
-- Обгортка public.submit_purchase і grants лишаються з попередньої міграції.

create or replace function private.submit_purchase(p_department_id uuid, p_purchase_type text, p_lines jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_role text;
  v_purchase_id uuid;
  -- «Порожні» символи для полів рядка — ті самі, що прибирає trim() у формі: пробіл, \t, \n, вертикальна табуляція,
  -- form feed, \r, нерозривний пробіл. Один набір і в перевірці LINE_FIELDS, і під час запису.
  v_blank constant text := ' ' || chr(9) || chr(10) || chr(11) || chr(12) || chr(13) || chr(160);
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

  -- Рядки (AC-FRM-06): окремі послідовні перевірки — порядок частин AND PostgreSQL не гарантує,
  -- тож jsonb_array_length не виконується раніше за перевірку типу.
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

  -- Усі чотири поля рядка обов'язкові (AC-FRM-15; відповідь PM ValiaBihun/2026-quitcode-dream-team#60). Перевіряємо
  -- лише заповненість: межі значень (ціла кількість від 1, ціна від 0) — наступний зріз.
  if exists (
    select 1 from jsonb_array_elements(p_lines) as line(value)
    where nullif(btrim(line.value ->> 'name', v_blank), '') is null
       or nullif(btrim(line.value ->> 'purpose', v_blank), '') is null
       or nullif(btrim(line.value ->> 'quantity', v_blank), '') is null
       or nullif(btrim(line.value ->> 'unit_price', v_blank), '') is null
  ) then
    raise exception 'LINE_FIELDS';
  end if;

  -- Наявність схвалювача не перевіряємо: заявка чекає (AC-FRM-12, AC-FRM-13; відповідь PM
  -- ValiaBihun/2026-quitcode-dream-team#52).
  insert into public.purchases (author_id, department_id, purchase_type)
  values (v_uid, p_department_id, p_purchase_type)
  returning id into v_purchase_id;

  -- Кількість чи ціну, які не приводяться до типу колонки (не ціле число, не число, задовге для numeric(12, 2)),
  -- показуємо помилкою форми INVALID_LINE, а не помилкою бази. Межі значень (ціла кількість від 1, ціна від 0) —
  -- наступний зріз. Виняток скасовує всю функцію, тож заявка без рядків не лишається.
  begin
    insert into public.purchase_lines (purchase_id, position, name, purpose, quantity, unit_price)
    select
      v_purchase_id,
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

  return v_purchase_id;
end;
$$;
