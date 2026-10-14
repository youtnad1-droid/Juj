
create type public.app_role as enum ('buyer','seller','admin');
create type public.user_status as enum ('active','suspended','banned');
create type public.delivery_type as enum ('auto_codes','manual');
create type public.offer_status as enum ('draft','active','paused','archived');
create type public.verification_status as enum ('unverified','pending','verified','rejected');

-- profiles = app "users" table (password hashing + email verification handled by auth)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  status public.user_status not null default 'active',
  locale text not null default 'en' check (char_length(locale) between 2 and 10),
  currency char(3) not null default 'USD',
  theme text not null default 'system' check (theme in ('light','dark','system')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "own profile read" on public.profiles for select to authenticated using (auth.uid() = id);
create policy "own profile update" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles read" on public.user_roles for select to authenticated using (auth.uid() = user_id);

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.user_roles where user_id = _user_id and role = _role) $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict do nothing;
  insert into public.user_roles (user_id, role) values (new.id, 'buyer') on conflict do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create table public.seller_profiles (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  bio text check (char_length(bio) <= 2000),
  country char(2),
  verification_status public.verification_status not null default 'unverified',
  rating_avg numeric(3,2) not null default 0 check (rating_avg between 0 and 5),
  rating_count integer not null default 0 check (rating_count >= 0),
  sales_count integer not null default 0 check (sales_count >= 0),
  created_at timestamptz not null default now()
);
grant select on public.seller_profiles to anon, authenticated;
grant all on public.seller_profiles to service_role;
alter table public.seller_profiles enable row level security;
create policy "public sellers" on public.seller_profiles for select to anon, authenticated using (true);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null,
  icon text,
  seo_text text,
  commission_percent numeric(5,2) not null default 10 check (commission_percent between 0 and 100),
  sort_order integer not null default 0,
  show_in_header boolean not null default false,
  is_active boolean not null default true
);
create index on public.categories(parent_id);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;
create policy "public active categories" on public.categories for select to anon, authenticated using (is_active);

create table public.offers (
  id bigint generated always as identity primary key,
  seller_id uuid not null references public.seller_profiles(user_id) on delete cascade,
  category_id uuid not null references public.categories(id),
  slug text not null check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (char_length(title) between 3 and 160),
  description text not null default '',
  image_url text,
  price_minor integer not null check (price_minor >= 0),
  old_price_minor integer check (old_price_minor is null or old_price_minor > price_minor),
  currency char(3) not null default 'USD',
  delivery_type public.delivery_type not null default 'auto_codes',
  stock_count integer not null default 0 check (stock_count >= 0),
  sales_count integer not null default 0 check (sales_count >= 0),
  status public.offer_status not null default 'draft',
  region text,
  platform text,
  created_at timestamptz not null default now()
);
create index on public.offers(category_id, status);
create index on public.offers(seller_id, status);
create index on public.offers(sales_count desc, id desc);
create index on public.offers(price_minor, id);
grant select on public.offers to anon, authenticated;
grant all on public.offers to service_role;
alter table public.offers enable row level security;
create policy "public active offers" on public.offers for select to anon, authenticated using (status = 'active');

create table public.offer_options (
  id uuid primary key default gen_random_uuid(),
  offer_id bigint not null references public.offers(id) on delete cascade,
  label text not null check (char_length(label) between 1 and 80),
  price_minor integer not null check (price_minor >= 0),
  sort_order integer not null default 0
);
create index on public.offer_options(offer_id);
grant select on public.offer_options to anon, authenticated;
grant all on public.offer_options to service_role;
alter table public.offer_options enable row level security;
create policy "public options" on public.offer_options for select to anon, authenticated
  using (exists (select 1 from public.offers o where o.id = offer_id and o.status = 'active'));

create table public.offer_input_fields (
  id uuid primary key default gen_random_uuid(),
  offer_id bigint not null references public.offers(id) on delete cascade,
  key text not null check (key ~ '^[a-z][a-z0-9_]{0,39}$' and key !~* 'pass|pwd|secret'),
  label text not null check (char_length(label) between 1 and 80 and label !~* 'password'),
  type text not null check (type in ('text','select','number')),
  select_options text[],
  required boolean not null default true,
  sort_order integer not null default 0,
  unique (offer_id, key)
);
grant select on public.offer_input_fields to anon, authenticated;
grant all on public.offer_input_fields to service_role;
alter table public.offer_input_fields enable row level security;
create policy "public fields" on public.offer_input_fields for select to anon, authenticated
  using (exists (select 1 from public.offers o where o.id = offer_id and o.status = 'active'));

create table public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  offer_id bigint not null references public.offers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, offer_id)
);
grant select, insert, delete on public.favorites to authenticated;
grant all on public.favorites to service_role;
alter table public.favorites enable row level security;
create policy "own favorites read" on public.favorites for select to authenticated using (auth.uid() = user_id);
create policy "own favorites add" on public.favorites for insert to authenticated with check (auth.uid() = user_id);
create policy "own favorites remove" on public.favorites for delete to authenticated using (auth.uid() = user_id);

-- all descendant category ids (including self)
create or replace function public.category_subtree(_root uuid)
returns setof uuid language sql stable set search_path = public
as $$
  with recursive t as (
    select id from categories where id = _root and is_active
    union all
    select c.id from categories c join t on c.parent_id = t.id where c.is_active
  ) select id from t
$$;
grant execute on function public.category_subtree(uuid) to anon, authenticated;
