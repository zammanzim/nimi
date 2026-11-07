-- ============================================================
-- Migration: 2026-11-04 — schedule_periods.subject_id + data guards
-- ============================================================
-- Aman dijalankan pada project live yang sudah berisi data.
-- File ini idempotent (boleh dijalankan ulang).
-- ============================================================

begin;

-- 1) Hubungkan baris jadwal ke mapel asli (bukan hanya teks label).
alter table v3.schedule_periods
    add column if not exists subject_id bigint references v3.subjects(id) on delete set null;

create index if not exists schedule_periods_subject_idx
    on v3.schedule_periods (subject_id);

-- Backfill aman: nama sama persis atau alias umum, tanpa fuzzy matching.
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

-- 2) Pastikan kolom fitur yang sudah dipakai UI ada di semua environment.
alter table v3.subjects
    add column if not exists color text;

with ranked as (
    select id,
           row_number() over (partition by class_id order by urutan, id) as rn
    from v3.subjects
    where color is null or btrim(color) = ''
)
update v3.subjects s
set color = (array['#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#14b8a6'])[((r.rn - 1) % 7) + 1]
from ranked r
where s.id = r.id;

update v3.subjects set color = '#2563eb' where color is null or btrim(color) = '';
alter table v3.subjects alter column color set default '#2563eb';
alter table v3.subjects alter column color set not null;

alter table v3.cards
    add column if not exists has_task boolean;
update v3.cards set has_task = true where kind = 'tugas' and has_task is distinct from true;
update v3.cards set has_task = false where has_task is null;
alter table v3.cards alter column has_task set default false;
alter table v3.cards alter column has_task set not null;

-- 3) Deadline menyimpan tanggal + jam.
alter table v3.cards
    alter column task_due type timestamptz using task_due::timestamptz;

-- 4) Tambahkan index pengunjung untuk query "hari ini".
create index if not exists visitors_class_idx
    on v3.visitors (class_id, visited_at desc);

notify pgrst, 'reload schema';

commit;
