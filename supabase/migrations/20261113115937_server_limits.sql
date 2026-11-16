-- Серверні ліміти тексту й кількості рядків (зауваження PM 5, kdeineko-tech/school-purchasing#70).
-- Досі довжину причини обмежував лише maxLength={500} у формі, а назву й мету рядка та кількість рядків — ніщо:
-- прямий виклик rpc це обходить. Чисел PM не задавав, тож беремо 500 символів (як уже має поле причини у формі) і
-- 100 рядків на заявку — з запасом для справжніх заявок; поведінку, описану в AC, це не змінює.
--
-- 1. private.insert_purchase_lines (її викликають submit_purchase і resubmit_purchase): TOO_MANY_LINES — понад 100
--    рядків. Довжину назви й мети перевіряє тригер (п. 2) — і для цієї функції, і для будь-якого іншого запису.
-- 2. У таблицях — тримає й service_role, і будь-яку майбутню функцію.
--    purchase_lines — тригер LINE_TOO_LONG (застосунок перекладає його в повідомлення форми) лише на запис name чи
--    purpose, а не check: decide_purchase для approve і reject оновлює status кожного рядка заявки, і check перевірив
--    би весь рядок — тоді заявку зі старим рядком понад 500 символів (введеним до лімітів) не можна було б ні схвалити,
--    ні відхилити. `update of name, purpose` на оновлення status не спрацьовує.
--    purchases — check NOT VALID на причини: наявні рядки не перевіряємо, а decide_purchase і resubmit_purchase щоразу
--    переписують обидві причини (нова причина або null), тож стара довга причина рішенню не заважає. decide_purchase
--    не змінюємо: порушення check застосунок упізнає за назвою обмеження, а validateDecision відмовляє ще до бази.

-- 1. Рядки: перевірки з 20261106234630_purchase_number.sql без змін, плюс кількість.
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

  -- Значення, що не приводяться до типу колонки, — помилка форми INVALID_LINE, а не помилка бази. Назву й мету довші
  -- за 500 символів (уже обрізані) відхиляє тригер purchase_lines_text_length нижче — LINE_TOO_LONG.
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

-- 2. Довжина назви й мети рядка; причини рішень.
create function private.check_purchase_line_lengths()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if char_length(new.name) > 500 or char_length(new.purpose) > 500 then
    raise exception 'LINE_TOO_LONG';
  end if;
  return new;
end;
$$;
revoke execute on function private.check_purchase_line_lengths() from public, anon, authenticated;

create trigger purchase_lines_text_length
  before insert or update of name, purpose on public.purchase_lines
  for each row execute function private.check_purchase_line_lengths();

alter table public.purchases
  add constraint purchases_rejection_reason_length check (char_length(rejection_reason) <= 500) not valid,
  add constraint purchases_return_reason_length check (char_length(return_reason) <= 500) not valid;
