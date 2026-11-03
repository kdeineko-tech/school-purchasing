-- Політика видимості заявок: умови одним списком, перевірка ролі адміністратора — першою (найдешевша: роль з
-- profiles переглядача, без підзапиту до department_members). Хто бачить заявку — як і раніше: автор, схвалювач її
-- відділу й адміністратор (матриця прав requirements/product.md, «Бачити заявки»; AC-FRM-08, AC-FRM-10, AC-APR-03).
drop policy if exists purchases_select_visible on public.purchases;

create policy purchases_select_visible
  on public.purchases
  for select
  to authenticated
  using (
    (select private.current_app_role()) = 'admin'
    or author_id = (select auth.uid())
    or (select private.approves_department(department_id))
  );
