-- РИЗИК: деструктивна міграція (drop table) — видаляє дві таблиці разом із даними. Дані в них — демо-рядки навчальної
-- домашки WS5 (LeadDesk), до продукту School Purchasing стосунку не мають; розробниця погодила видалення 2026-11-28.
--
-- Звідки таблиці: 2026-11-27 22:10 UTC домашка WS5 через Supabase MCP (apply_migration «leaddesk», запис історії
-- 20261127221018) створила в прод-базі public.leads і public.lead_audit і вставила демо-рядки. Причина — ліміт
-- безкоштовного Supabase на два активні проєкти (прод і staging уже зайняті). Запису 20261127221018 немає в репо,
-- тож db-deploy зупинився («Remote migration versions not found in local migrations directory»). Історію виправляє
-- людина (`supabase migration repair --status reverted 20261127221018`), а ця міграція прибирає самі таблиці, щоб
-- схема проду знову збігалася з main.
--
-- `if exists`: на staging, локальній і одноразовій базі db-check цих таблиць ніколи не було — там міграція нічого не
-- робить. Індекс leads_status_created_at_idx і зовнішній ключ lead_audit → leads зникають разом із таблицями.
drop table if exists public.lead_audit;
drop table if exists public.leads;
