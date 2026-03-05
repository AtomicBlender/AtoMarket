-- Run after creating at least one auth user/profile.
-- Replace user ids as needed.
insert into public.markets (
  title,
  question,
  category,
  status,
  close_time,
  resolution_deadline,
  resolution_type,
  resolution_source,
  resolution_url,
  resolution_rule,
  challenge_window_hours,
  created_by
)
select
  'NRC Docket Posted by June 30, 2026',
  'Will NRC publish docket number NRC-2026-0137 by June 30, 2026?',
  'Regulation',
  'OPEN',
  now() + interval '7 days',
  now() + interval '21 days',
  'URL_SELECTOR',
  'NRC docket website',
  'https://www.regulations.gov',
  '{"selector":"body","operator":"contains","compare_value":"NRC-2026-0137"}'::jsonb,
  48,
  p.id
from public.profiles p
limit 1;

insert into public.markets (
  title,
  question,
  category,
  status,
  close_time,
  resolution_deadline,
  resolution_type,
  resolution_source,
  resolution_url,
  resolution_rule,
  challenge_window_hours,
  created_by
)
select
  'DOE API Reports New Reactor Grant',
  'Will DOE grants API list at least one new reactor grant before July 15, 2026?',
  'Funding',
  'OPEN',
  now() + interval '10 days',
  now() + interval '24 days',
  'JSON_PATH',
  'DOE public API',
  'https://api.energy.gov/data',
  '{"json_path":"$.results[0].type","operator":"equals","compare_value":"reactor_grant"}'::jsonb,
  48,
  p.id
from public.profiles p
limit 1;

insert into public.markets (
  title,
  question,
  category,
  status,
  close_time,
  resolution_deadline,
  resolution_type,
  resolution_source,
  resolution_rule,
  challenge_window_hours,
  proposal_bond_neutrons,
  challenge_bond_neutrons,
  created_by
)
select
  'SMR Pilot Site Announced by Utility X',
  'Will Utility X announce a signed SMR pilot site agreement by August 31, 2026?',
  'Development',
  'OPEN',
  now() + interval '14 days',
  now() + interval '35 days',
  'MANUAL_WITH_BOND',
  'Utility X press releases + SEC filings',
  '{"evidence_requirements":"Press release link and filing link with date and signatory details."}'::jsonb,
  48,
  500,
  500,
  p.id
from public.profiles p
limit 1;
