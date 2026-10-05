-- Isis Avelar Nail Simulator backend
-- Run this entire file in Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.nail_palette (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 120),
  hex text not null check (hex ~ '^#[0-9A-Fa-f]{6}$'),
  enabled boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.nail_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.nail_palette enable row level security;
alter table public.nail_admins enable row level security;

revoke all on table public.nail_palette from anon, authenticated;
revoke all on table public.nail_admins from anon, authenticated;
grant select on table public.nail_palette to anon, authenticated;

create or replace function public.is_nail_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.nail_admins
    where user_id = auth.uid()
  );
$$;

revoke all on function public.is_nail_admin() from public;
grant execute on function public.is_nail_admin() to authenticated;

drop policy if exists "Public can read active nail colors" on public.nail_palette;
drop policy if exists "Admins can read all nail colors" on public.nail_palette;
drop policy if exists "Admins can insert nail colors" on public.nail_palette;
drop policy if exists "Admins can update nail colors" on public.nail_palette;
drop policy if exists "Admins can delete nail colors" on public.nail_palette;

create policy "Public can read active nail colors"
on public.nail_palette
for select
to anon, authenticated
using (enabled = true);

create policy "Admins can read all nail colors"
on public.nail_palette
for select
to authenticated
using (public.is_nail_admin());

create policy "Admins can insert nail colors"
on public.nail_palette
for insert
to authenticated
with check (public.is_nail_admin());

create policy "Admins can update nail colors"
on public.nail_palette
for update
to authenticated
using (public.is_nail_admin())
with check (public.is_nail_admin());

create policy "Admins can delete nail colors"
on public.nail_palette
for delete
to authenticated
using (public.is_nail_admin());

-- Atomic replacement used by the admin page.
create or replace function public.save_nail_palette(p_items jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  item jsonb;
  item_count integer;
  active_count integer;
  item_name text;
  item_hex text;
  item_enabled boolean;
  item_order integer;
begin
  if not public.is_nail_admin() then
    raise exception 'Not authorized';
  end if;

  if jsonb_typeof(p_items) <> 'array' then
    raise exception 'Palette must be a JSON array';
  end if;

  item_count := jsonb_array_length(p_items);
  if item_count < 1 then
    raise exception 'Palette cannot be empty';
  end if;
  if item_count > 200 then
    raise exception 'Palette cannot contain more than 200 colors';
  end if;

  active_count := 0;

  for item in select * from jsonb_array_elements(p_items)
  loop
    item_name := btrim(coalesce(item->>'name', ''));
    item_hex := upper(btrim(coalesce(item->>'hex', '')));
    item_enabled := coalesce((item->>'enabled')::boolean, true);

    if item_name = '' or char_length(item_name) > 120 then
      raise exception 'Invalid color name';
    end if;
    if item_hex !~ '^#[0-9A-F]{6}$' then
      raise exception 'Invalid color HEX: %', item_hex;
    end if;

    if item_enabled then
      active_count := active_count + 1;
    end if;
  end loop;

  if active_count < 1 then
    raise exception 'Keep at least one color enabled';
  end if;

  delete from public.nail_palette;

  item_order := 0;
  for item in select * from jsonb_array_elements(p_items)
  loop
    insert into public.nail_palette (name, hex, enabled, sort_order, updated_at)
    values (
      btrim(item->>'name'),
      upper(btrim(item->>'hex')),
      coalesce((item->>'enabled')::boolean, true),
      item_order,
      now()
    );
    item_order := item_order + 1;
  end loop;
end;
$$;

revoke all on function public.save_nail_palette(jsonb) from public;
grant execute on function public.save_nail_palette(jsonb) to authenticated;

-- Remove any previous palette contents before the first seed.
delete from public.nail_palette;

insert into public.nail_palette (name, hex, enabled, sort_order) values
('Colorama Gabriele','#c41224',true,0),
('Colorama Tapete Vermelho','#b31217',true,1),
('Colorama Vermelho Ivete','#990f1d',true,2),
('Colorama Paixão','#75141e',true,3),
('Colorama Melancia','#e83344',true,4),
('Colorama Fini Última Fini','#e02838',true,5),
('Risqué KitKat Mania','#a91b29',true,6),
('Colorama Fini Beijos de Fini','#dc1868',true,7),
('Colorama Toda Barbiezinha','#f398b5',true,8),
('Colorama Boneca','#e4a8b7',true,9),
('Colorama Rosa de Vergonha','#db5288',true,10),
('Colorama Puro Glamour','#d42065',true,11),
('Colorama Rosa Antigo','#9d5d6a',true,12),
('Colorama Algodão Doce','#f6d2da',true,13),
('Colorama Pétala','#f7dde5',true,14),
('Risqué Rose Bombom','#f0b5be',true,15),
('Risqué Amor à Primeira Mordida','#be1d58',true,16),
('Risqué Nude','#c9a595',true,17),
('Risqué Pó de Arroz','#eedcd5',true,18),
('Colorama Chic Bege','#c3a492',true,19),
('Colorama Nude 2.0','#8c7f7a',true,20),
('Colorama Nude 3.0','#9e7b68',true,21),
('Colorama Nude 7.0','#7c5132',true,22),
('Risqué Chik Pop','#bf9b88',true,23),
('Risqué Cappuccino','#826359',true,24),
('Risqué Bali','#7d595e',true,25),
('Risqué Astral','#b4858d',true,26),
('Risqué Energia','#995c64',true,27),
('Risqué Terracota que Provoca','#8b4a3a',true,28),
('Risqué Meu Wafervorito','#ded5b8',true,29),
('Risqué Só Mais Um Pedacinho','#8e5428',true,30),
('Risqué Vem Kit Kero','#6c4b37',true,31),
('Risqué Choco Cósmico','#4a2824',true,32),
('Risqué Crocante na Medida','#6d7649',true,33),
('Risqué O Break Perfeito Existe','#7f5e9d',true,34),
('Risqué Eu Mereço Esse Glow','#19586b',true,35),
('Colorama Retrô Zazá','#b3bfdb',true,36),
('Risqué Gota dos Anjos','#d9cfba',true,37),
('Colorama Black','#1a1a1a',true,38);
