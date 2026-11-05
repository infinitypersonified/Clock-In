-- Run this whole file in Supabase > SQL Editor
create table offices (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Main Office',
  lat double precision not null,
  lng double precision not null,
  radius_m int not null default 100
);
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text,
  role text not null default 'employee' check (role in ('employer','employee'))
);
create table clock_ins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  type text not null check (type in ('in','out')),
  at timestamptz not null default now(),
  lat double precision, lng double precision,
  accuracy_m real, distance_m real,
  status text not null check (status in ('at_office','away','unverified'))
);
create index on clock_ins (at desc);

-- First person to sign up becomes the employer; everyone after is an employee
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, full_name, role)
  values (new.id, new.raw_user_meta_data->>'full_name',
    case when exists (select 1 from profiles) then 'employee' else 'employer' end);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create function is_employer() returns boolean language sql security definer set search_path = public stable as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'employer')
$$;

alter table offices enable row level security;
alter table profiles enable row level security;
alter table clock_ins enable row level security;

create policy "read office" on offices for select to authenticated using (true);
create policy "employer manages office" on offices for all to authenticated using (is_employer()) with check (is_employer());
create policy "read own or all if employer" on profiles for select to authenticated using (id = auth.uid() or is_employer());
create policy "insert own clock-in" on clock_ins for insert to authenticated with check (user_id = auth.uid());
create policy "read own or all if employer" on clock_ins for select to authenticated using (user_id = auth.uid() or is_employer());
