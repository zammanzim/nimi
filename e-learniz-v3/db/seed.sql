-- ============================================================
-- e-learniz v3 — SEED (data awal + migrasi ringan dari app lama)
-- Jalanin SETELAH db/schema.sql (sekali, di project yang sama).
-- Baca data dari schema public (app lama) — password TIDAK dibawa.
-- ============================================================

-- 1) KELAS — dari public.classes (yang aktif)
insert into v3.classes (id, name, academic_year, is_active)
select id, name, coalesce(academic_year, '2026/2027'), true
from public.classes
where is_active and id > 0
order by id
on conflict (id) do update set
    name = excluded.name,
    academic_year = excluded.academic_year,
    is_active = excluded.is_active;

-- 2) SISWA — dari public.users (kelas 1-4).
--    Password lama dibuang total; siswa sekarang cukup pilih nama.
--    Role/auth_user_id baris yang sudah ada TIDAK ditimpa, supaya akun
--    staf yang sudah terhubung ke Supabase Auth tetap aman.
insert into v3.users (id, class_id, nickname, full_name, role, avatar_url)
select u.id, u.class_id,
       coalesce(nullif(trim(u.nickname), ''), nullif(trim(u.full_name), ''), 'Siswa'),
       coalesce(u.full_name, ''),
       'student',
       coalesce(u.avatar_url, '')
from public.users u
where u.class_id in (1, 2, 3, 4)
order by u.id
on conflict (id) do update set
    class_id = excluded.class_id,
    nickname = excluded.nickname,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url;

-- 3) MAPEL — dari public.subjects_config (menu_group='lessons') + guru.
--    Hasil: 14 mapel per kelas (1-4), lengkap sama kontak guru kalau ada.
insert into v3.subjects (class_id, slug, name, icon, urutan, locked, teacher_name, teacher_contact)
select sc.class_id::bigint,
       sc.subject_id,
       sc.subject_name,
       coalesce(nullif(sc.icon, ''), 'fa-book'),
       coalesce(sc.display_order, 99),
       coalesce(sc.locked, false),
       coalesce(t.teacher_name, ''),
       case when t.teacher_contact ilike '%not been%' then '' else coalesce(t.teacher_contact, '') end
from public.subjects_config sc
left join public.subject_teachers t on t.subject_id = sc.subject_id
where sc.menu_group = 'lessons'
  and sc.class_id in ('1','2','3','4')
order by sc.class_id, sc.display_order
on conflict (class_id, slug) do update set
    name = excluded.name,
    icon = excluded.icon,
    urutan = excluded.urutan,
    locked = excluded.locked,
    teacher_name = excluded.teacher_name,
    teacher_contact = excluded.teacher_contact;

-- 4) KONTEN — (DIHAPUS) kartu lama dari public.subject_announcements nggak
--    dimigrasiin lagi. Tabel v3.cards sengaja dikosongin biar diisi fresh
--    lewat UI staff (toolbar di halaman pengumuman/tugas/mapel).
--    Backup kartu lama: db/backup-cards-20261026.json (227 baris).

-- 5) Rapiin sequence (kelas & users di-insert pakai id manual dari app lama)
select setval(
    pg_get_serial_sequence('v3.classes', 'id'),
    greatest(coalesce((select max(id) from v3.classes), 0), 1),
    coalesce((select max(id) from v3.classes), 0) > 0
);
select setval(
    pg_get_serial_sequence('v3.users', 'id'),
    greatest(coalesce((select max(id) from v3.users), 0), 1),
    coalesce((select max(id) from v3.users), 0) > 0
);

-- 6) JADWAL (daily card) — dari public.daily_schedules (type='regular').
--    String '06.30 - 08.00 - PPK; ...' dipecah jadi baris per periode
--    (jam mulai/selesai + jenis: belajar/istirahat/kegiatan/pulang).
--    Info hari (seragam/piket/aktivitas/catatan) masuk schedule_days.
--    Entri iseng zaman dulu ('iwak tempik', jam '00.00') di-skip;
--    Sabtu & Minggu otomatis ditandai libur (is_school = false).

-- 6a) info per hari
insert into v3.schedule_days (class_id, weekday, is_school, uniform, picket, activity, notes)
select ds.class_id::bigint,
       case ds.day_name
         when 'Senin' then 1 when 'Selasa' then 2 when 'Rabu' then 3
         when 'Kamis' then 4 when 'Jumat' then 5 when 'Sabtu' then 6
         when 'Minggu' then 7
       end,
       exists (
         select 1
         from regexp_split_to_table(ds.lessons, ';') as e
         where btrim(e) ~ '^[0-9]{1,2}[.:][0-9]{2}'
           and btrim(e) !~* 'iwak|tempik'
           and btrim(e) !~ '^00[.:]00'
       ),
       coalesce(nullif(btrim(ds.uniform), '-'), ''),
       coalesce(btrim(ds.picket), ''),
       coalesce(nullif(btrim(ds.activity), '-'), ''),
       coalesce(nullif(btrim(ds.notes), '-'), '')
from public.daily_schedules ds
where ds.type = 'regular'
  and ds.class_id in ('1','2','3','4')
  and ds.day_name in ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu')
on conflict (class_id, weekday) do update set
    is_school = excluded.is_school,
    uniform = excluded.uniform,
    picket = excluded.picket,
    activity = excluded.activity,
    notes = excluded.notes;

-- 6b) periode pelajaran
insert into v3.schedule_periods (class_id, weekday, urutan, time_start, time_end, label, kind)
with raw as (
  select ds.class_id::bigint as class_id,
         case ds.day_name
           when 'Senin' then 1 when 'Selasa' then 2 when 'Rabu' then 3
           when 'Kamis' then 4 when 'Jumat' then 5 when 'Sabtu' then 6
           when 'Minggu' then 7
         end as weekday,
         btrim(t.entry) as entry,
         t.ord
  from public.daily_schedules ds
  cross join lateral regexp_split_to_table(ds.lessons, ';') with ordinality as t(entry, ord)
  where ds.type = 'regular'
    and ds.class_id in ('1','2','3','4')
    and ds.day_name in ('Senin','Selasa','Rabu','Kamis','Jumat','Sabtu','Minggu')
),
parsed as (
  select class_id, weekday, entry, ord,
         regexp_match(entry, '^([0-9]{1,2})[.:]([0-9]{2})(?:[[:space:]]*-[[:space:]]*([0-9]{1,2})[.:]([0-9]{2}))?[[:space:]]*-[[:space:]]*(.+)$') as m
  from raw
  where entry <> ''
)
select class_id,
       weekday,
       row_number() over (partition by class_id, weekday order by ord)::int as urutan,
       lpad((m)[1], 2, '0') || ':' || (m)[2] as time_start,
       case when (m)[3] is null then '' else lpad((m)[3], 2, '0') || ':' || (m)[4] end as time_end,
       btrim((m)[5]) as label,
       case
         when btrim((m)[5]) ~* '^pulang' then 'pulang'
         when btrim((m)[5]) ~* 'istirahat|ishoma' then 'istirahat'
         when btrim((m)[5]) ~* 'upacara|sholat|dhuha|senam|skj|ppk|kamsih|literasi|pembiasaan|doa' then 'kegiatan'
         else 'belajar'
       end as kind
from parsed
where m is not null
  and entry !~* 'iwak|tempik'
  and (m)[1] <> '00'
on conflict (class_id, weekday, urutan) do update set
    time_start = excluded.time_start,
    time_end = excluded.time_end,
    label = excluded.label,
    kind = excluded.kind;

-- 6c) Hubungkan periode ke mapel (subject_id).
update v3.schedule_periods p
set subject_id = s.id
from v3.subjects s
where p.subject_id is null
  and p.kind = 'belajar'
  and p.class_id = s.class_id
  and lower(btrim(p.label)) = lower(btrim(s.name));

with alias_map(label, slug) as (
  values
    ('Bahasa Indonesia', 'bahasaindonesia'),
    ('Bahasa Inggris', 'bahasainggris'),
    ('Bahasa Sunda', 'bahasasunda'),
    ('Bahasa Jepang', 'bahasajepang'),
    ('B. Indonesia', 'bahasaindonesia'),
    ('B. Inggris', 'bahasainggris'),
    ('B. Sunda', 'bahasasunda'),
    ('B. Jepang', 'bahasajepang'),
    ('MTK', 'matematika')
)
update v3.schedule_periods p
set subject_id = s.id
from alias_map a
join v3.subjects s on s.slug = a.slug
where p.subject_id is null
  and p.kind = 'belajar'
  and p.class_id = s.class_id
  and lower(btrim(p.label)) = lower(a.label);
