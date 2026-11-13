-- Серверні ліміти тексту й кількості рядків (зауваження PM 5, kdeineko-tech/school-purchasing#70).
-- Досі довжину причини обмежував лише maxLength={500} у формі, а назву й мету рядка та кількість рядків — ніщо:
-- прямий виклик rpc це обходить. Чисел PM не задавав, тож беремо 500 символів (як уже має поле причини у формі) і
-- 100 рядків на заявку — з запасом для справжніх заявок; поведінку, описану в AC, це не змінює.
--
-- 1. Перша лінія — private.insert_purchase_lines (її викликають submit_purchase і resubmit_purchase): зрозумілі коди
--    TOO_MANY_LINES і LINE_TOO_LONG, які застосунок перекладає в повідомлення форми.
-- 2. Друга лінія — check у таблицях: тримає й service_role, і будь-яку майбутню функцію. Причини рішень (rejection_reason,
--    return_reason) записує decide_purchase; її не змінюємо — порушення check ловить застосунок за назвою обмеження,
--    а validateDecision відмовляє ще до виклику бази.
--    NOT VALID: наявні рядки на проді не перевіряємо (їх могли ввести до лімітів), нові й змінені — так.

-- 1. Рядки: перевірки з 20261106234630_purchase_number.sql без змін, плюс кількість і довжина.
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
  if jsonb_array_length(p_lines) > 100 then
    raise exception 'TOO_MANY_LINES';
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

  -- Назва й мета — не довші за 500 символів після обрізання (char_length — символи, не байти).
  if exists (
    select 1 from jsonb_array_elements(p_lines) as line(value)
    where char_length(btrim(line.value ->> 'name', v_blank)) > 500
       or char_length(btrim(line.value ->> 'purpose', v_blank)) > 500
  ) then
    raise exception 'LINE_TOO_LONG';
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

-- 2. Друга лінія в таблицях.
alter table public.purchase_lines
  add constraint purchase_lines_name_length check (char_length(name) <= 500) not valid,
  add constraint purchase_lines_purpose_length check (char_length(purpose) <= 500) not valid;

alter table public.purchases
  add constraint purchases_rejection_reason_length check (char_length(rejection_reason) <= 500) not valid,
  add constraint purchases_return_reason_length check (char_length(return_reason) <= 500) not valid;
