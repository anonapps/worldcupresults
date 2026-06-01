-- Module 6 baseline seed data for World Cup 2026 simulator

with canonical_rule_version as (
  select id
  from public.tournament_rule_versions
  where version_name = 'FIFA_WORLD_CUP_2026_BASELINE'
     or version_name = 'WORLD_CUP_2026_BASELINE'
     or (lower(version_name) like '%world%cup%2026%' and lower(version_name) like '%baseline%')
     or (lower(description) like '%world cup 2026%' and lower(description) like '%baseline%')
  order by created_at asc
  limit 1
), inserted_rule_version as (
  insert into public.tournament_rule_versions (version_name, effective_from, description, rules_payload)
  select
    'FIFA_WORLD_CUP_2026_BASELINE',
    '2026-06-11T00:00:00Z',
    'Baseline World Cup 2026 structure with 48 seeded slots and full tournament skeleton',
    jsonb_build_object(
      'tournament', 'FIFA World Cup 2026',
      'ruleset', 'baseline',
      'format', '12 groups of 4, knockout from round of 32'
    )
  where not exists (select 1 from canonical_rule_version)
  on conflict (version_name) do nothing
  returning id
), selected_rule_version as (
  select id from canonical_rule_version
  union all
  select id from inserted_rule_version
  union all
  select id from public.tournament_rule_versions where version_name = 'FIFA_WORLD_CUP_2026_BASELINE'
  limit 1
), seeded_teams as (
  insert into public.teams (fifa_code, name_es, flag_url, confederation)
  values
    ('AAA','Slot 01','https://example.com/flags/aaa.svg','TBD'),('AAB','Slot 02','https://example.com/flags/aab.svg','TBD'),('AAC','Slot 03','https://example.com/flags/aac.svg','TBD'),('AAD','Slot 04','https://example.com/flags/aad.svg','TBD'),
    ('AAE','Slot 05','https://example.com/flags/aae.svg','TBD'),('AAF','Slot 06','https://example.com/flags/aaf.svg','TBD'),('AAG','Slot 07','https://example.com/flags/aag.svg','TBD'),('AAH','Slot 08','https://example.com/flags/aah.svg','TBD'),
    ('AAI','Slot 09','https://example.com/flags/aai.svg','TBD'),('AAJ','Slot 10','https://example.com/flags/aaj.svg','TBD'),('AAK','Slot 11','https://example.com/flags/aak.svg','TBD'),('AAL','Slot 12','https://example.com/flags/aal.svg','TBD'),
    ('AAM','Slot 13','https://example.com/flags/aam.svg','TBD'),('AAN','Slot 14','https://example.com/flags/aan.svg','TBD'),('AAO','Slot 15','https://example.com/flags/aao.svg','TBD'),('AAP','Slot 16','https://example.com/flags/aap.svg','TBD'),
    ('AAQ','Slot 17','https://example.com/flags/aaq.svg','TBD'),('AAR','Slot 18','https://example.com/flags/aar.svg','TBD'),('AAS','Slot 19','https://example.com/flags/aas.svg','TBD'),('AAT','Slot 20','https://example.com/flags/aat.svg','TBD'),
    ('AAU','Slot 21','https://example.com/flags/aau.svg','TBD'),('AAV','Slot 22','https://example.com/flags/aav.svg','TBD'),('AAW','Slot 23','https://example.com/flags/aaw.svg','TBD'),('AAX','Slot 24','https://example.com/flags/aax.svg','TBD'),
    ('ABA','Slot 25','https://example.com/flags/aba.svg','TBD'),('ABB','Slot 26','https://example.com/flags/abb.svg','TBD'),('ABC','Slot 27','https://example.com/flags/abc.svg','TBD'),('ABD','Slot 28','https://example.com/flags/abd.svg','TBD'),
    ('ABE','Slot 29','https://example.com/flags/abe.svg','TBD'),('ABF','Slot 30','https://example.com/flags/abf.svg','TBD'),('ABG','Slot 31','https://example.com/flags/abg.svg','TBD'),('ABH','Slot 32','https://example.com/flags/abh.svg','TBD'),
    ('ABI','Slot 33','https://example.com/flags/abi.svg','TBD'),('ABJ','Slot 34','https://example.com/flags/abj.svg','TBD'),('ABK','Slot 35','https://example.com/flags/abk.svg','TBD'),('ABL','Slot 36','https://example.com/flags/abl.svg','TBD'),
    ('ABM','Slot 37','https://example.com/flags/abm.svg','TBD'),('ABN','Slot 38','https://example.com/flags/abn.svg','TBD'),('ABO','Slot 39','https://example.com/flags/abo.svg','TBD'),('ABP','Slot 40','https://example.com/flags/abp.svg','TBD'),
    ('ABQ','Slot 41','https://example.com/flags/abq.svg','TBD'),('ABR','Slot 42','https://example.com/flags/abr.svg','TBD'),('ABS','Slot 43','https://example.com/flags/abs.svg','TBD'),('ABT','Slot 44','https://example.com/flags/abt.svg','TBD'),
    ('ABU','Slot 45','https://example.com/flags/abu.svg','TBD'),('ABV','Slot 46','https://example.com/flags/abv.svg','TBD'),('ABW','Slot 47','https://example.com/flags/abw.svg','TBD'),('ABX','Slot 48','https://example.com/flags/abx.svg','TBD')
  on conflict (fifa_code) do nothing
  returning id
), seeded_groups as (
  insert into public.groups (group_name, tournament_rule_version_id)
  select g.group_name, rv.id
  from selected_rule_version rv
  cross join (values ('A'),('B'),('C'),('D'),('E'),('F'),('G'),('H'),('I'),('J'),('K'),('L')) as g(group_name)
  on conflict (tournament_rule_version_id, group_name) do nothing
  returning id
), group_slots as (
  select
    g.id as group_id,
    g.group_name,
    row_number() over (order by g.group_name) as group_num
  from public.groups g
  join selected_rule_version rv on rv.id = g.tournament_rule_version_id
), ordered_teams as (
  select id, row_number() over (order by fifa_code) as rn
  from public.teams
  where fifa_code between 'AAA' and 'ABX'
), seeded_assignments as (
  insert into public.group_team_assignments (group_id, team_id, seed_order)
  select gs.group_id, ot.id, slot.seed_order
  from group_slots gs
  join lateral (values (1),(2),(3),(4)) as slot(seed_order) on true
  join ordered_teams ot on ot.rn = ((gs.group_num - 1) * 4 + slot.seed_order)
  on conflict (group_id, team_id) do nothing
  returning id
), group_matches as (
  insert into public.matches (
    tournament_rule_version_id, stage, group_id, home_team_id, away_team_id,
    scheduled_at, status, source_type, source_reference, winner_team_id, is_locked
  )
  select
    rv.id,
    'group'::public.match_stage,
    g.id,
    t1.team_id,
    t2.team_id,
    ('2026-06-11T12:00:00Z'::timestamptz + (((row_number() over (order by g.group_name, p.pair_no)) - 1) * interval '1 day')),
    'scheduled'::public.match_status,
    'rule_generated'::public.match_source_type,
    format('GROUP_%s_M%s', g.group_name, p.pair_no),
    null,
    false
  from selected_rule_version rv
  join public.groups g on g.tournament_rule_version_id = rv.id
  join lateral (
    select
      (select gta.team_id from public.group_team_assignments gta where gta.group_id = g.id and gta.seed_order = 1) as s1,
      (select gta.team_id from public.group_team_assignments gta where gta.group_id = g.id and gta.seed_order = 2) as s2,
      (select gta.team_id from public.group_team_assignments gta where gta.group_id = g.id and gta.seed_order = 3) as s3,
      (select gta.team_id from public.group_team_assignments gta where gta.group_id = g.id and gta.seed_order = 4) as s4
  ) seeds on true
  join lateral (
    values
      (1, seeds.s1, seeds.s2),
      (2, seeds.s3, seeds.s4),
      (3, seeds.s1, seeds.s3),
      (4, seeds.s2, seeds.s4),
      (5, seeds.s1, seeds.s4),
      (6, seeds.s2, seeds.s3)
  ) as p(pair_no, team_a, team_b) on true
  join lateral (select p.team_a as team_id) t1 on true
  join lateral (select p.team_b as team_id) t2 on true
  where p.team_a is not null
    and p.team_b is not null
    and not exists (
      select 1 from public.matches m
      where m.tournament_rule_version_id = rv.id
        and m.source_reference = format('GROUP_%s_M%s', g.group_name, p.pair_no)
    )
  on conflict do nothing
  returning id
)
insert into public.matches (
  tournament_rule_version_id, stage, group_id, home_team_id, away_team_id,
  scheduled_at, status, source_type, source_reference, winner_team_id, is_locked
)
select
  rv.id,
  ko.stage::public.match_stage,
  null,
  ht.id,
  at.id,
  ko.scheduled_at,
  'scheduled'::public.match_status,
  'rule_generated'::public.match_source_type,
  ko.source_reference,
  null,
  false
from selected_rule_version rv
join (values
  ('round_of_32','2026-07-17T12:00:00Z'::timestamptz,'R32_01',1,2),('round_of_32','2026-07-17T16:00:00Z','R32_02',3,4),
  ('round_of_32','2026-07-18T12:00:00Z','R32_03',5,6),('round_of_32','2026-07-18T16:00:00Z','R32_04',7,8),
  ('round_of_32','2026-07-19T12:00:00Z','R32_05',9,10),('round_of_32','2026-07-19T16:00:00Z','R32_06',11,12),
  ('round_of_32','2026-07-20T12:00:00Z','R32_07',13,14),('round_of_32','2026-07-20T16:00:00Z','R32_08',15,16),
  ('round_of_32','2026-07-21T12:00:00Z','R32_09',17,18),('round_of_32','2026-07-21T16:00:00Z','R32_10',19,20),
  ('round_of_32','2026-07-22T12:00:00Z','R32_11',21,22),('round_of_32','2026-07-22T16:00:00Z','R32_12',23,24),
  ('round_of_32','2026-07-23T12:00:00Z','R32_13',25,26),('round_of_32','2026-07-23T16:00:00Z','R32_14',27,28),
  ('round_of_32','2026-07-24T12:00:00Z','R32_15',29,30),('round_of_32','2026-07-24T16:00:00Z','R32_16',31,32),
  ('round_of_16','2026-07-26T12:00:00Z','R16_01',1,3),('round_of_16','2026-07-26T16:00:00Z','R16_02',5,7),
  ('round_of_16','2026-07-27T12:00:00Z','R16_03',9,11),('round_of_16','2026-07-27T16:00:00Z','R16_04',13,15),
  ('round_of_16','2026-07-28T12:00:00Z','R16_05',17,19),('round_of_16','2026-07-28T16:00:00Z','R16_06',21,23),
  ('round_of_16','2026-07-29T12:00:00Z','R16_07',25,27),('round_of_16','2026-07-29T16:00:00Z','R16_08',29,31),
  ('quarter_final','2026-07-31T12:00:00Z','QF_01',1,5),('quarter_final','2026-07-31T16:00:00Z','QF_02',9,13),
  ('quarter_final','2026-08-01T12:00:00Z','QF_03',17,21),('quarter_final','2026-08-01T16:00:00Z','QF_04',25,29),
  ('semi_final','2026-08-04T16:00:00Z','SF_01',1,9),('semi_final','2026-08-05T16:00:00Z','SF_02',17,25),
  ('third_place','2026-08-08T15:00:00Z','TP_01',33,34),('final','2026-08-09T18:00:00Z','F_01',35,36)
) as ko(stage, scheduled_at, source_reference, home_slot, away_slot) on true
join ordered_teams ht on ht.rn = ko.home_slot
join ordered_teams at on at.rn = ko.away_slot
where not exists (
  select 1 from public.matches m
  where m.tournament_rule_version_id = rv.id
    and m.source_reference = ko.source_reference
);
