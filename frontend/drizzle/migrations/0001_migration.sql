
-- ===== SEED: users (password for all: JujDemo2026!) =====
do $$
declare
  u record;
begin
  for u in select * from (values
    ('00000000-0000-4000-a000-000000000001'::uuid, 'admin@juj.test'),
    ('00000000-0000-4000-a000-000000000011'::uuid, 'pixelvault@juj.test'),
    ('00000000-0000-4000-a000-000000000012'::uuid, 'keyforge@juj.test'),
    ('00000000-0000-4000-a000-000000000013'::uuid, 'robloxking@juj.test'),
    ('00000000-0000-4000-a000-000000000021'::uuid, 'buyer1@juj.test'),
    ('00000000-0000-4000-a000-000000000022'::uuid, 'buyer2@juj.test')
  ) as t(id, email)
  loop
    insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change)
    values ('00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
      extensions.crypt('JujDemo2026!', extensions.gen_salt('bf')), now(),
      '{"provider":"email","providers":["email"]}', '{}', now() - interval '400 days', now(), '', '', '', '')
    on conflict (id) do nothing;
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    values (gen_random_uuid(), u.id, u.id::text,
      jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true), 'email', now(), now(), now())
    on conflict do nothing;
  end loop;
end $$;

insert into public.user_roles (user_id, role) values
  ('00000000-0000-4000-a000-000000000001','admin'),
  ('00000000-0000-4000-a000-000000000011','seller'),
  ('00000000-0000-4000-a000-000000000012','seller'),
  ('00000000-0000-4000-a000-000000000013','seller')
on conflict do nothing;

insert into public.seller_profiles (user_id, display_name, bio, country, verification_status, rating_avg, rating_count, sales_count, created_at) values
  ('00000000-0000-4000-a000-000000000011','PixelVault','Gift cards and game currency, delivered in seconds. 24/7 support.','US','verified',4.92,1843,28410, now() - interval '700 days'),
  ('00000000-0000-4000-a000-000000000012','KeyForge','Official software keys and subscriptions from authorised distributors.','DE','verified',4.81,612,7320, now() - interval '420 days'),
  ('00000000-0000-4000-a000-000000000013','RobloxKing','Roblox specialist: Robux, top-ups and rare limiteds.','GB','pending',4.67,231,1290, now() - interval '150 days')
on conflict do nothing;

-- ===== SEED: categories =====
insert into public.categories (slug, name, icon, seo_text, commission_percent, sort_order, show_in_header) values
  ('games','Games','gamepad-2','Game currency, top-ups and items from trusted sellers.',10,1,false),
  ('software','Software','app-window','Licence keys for operating systems, office suites and tools.',8,2,false),
  ('subscriptions','Subscriptions','calendar-clock','Streaming, music and gaming subscriptions.',9,3,true),
  ('gift-cards','Gift cards','gift','Digital gift cards for stores and platforms.',6,4,true);
insert into public.categories (parent_id, slug, name, icon, seo_text, commission_percent, sort_order, show_in_header)
select id, 'roblox','Roblox','box','Robux, top-ups and limited items for Roblox.',10,1,true from public.categories where slug='games';
insert into public.categories (parent_id, slug, name, icon, seo_text, commission_percent, sort_order, show_in_header)
select id, 'playstation','PlayStation','gamepad','PlayStation wallet cards and PS Plus.',8,2,true from public.categories where slug='games';
insert into public.categories (parent_id, slug, name, icon, seo_text, commission_percent, sort_order, show_in_header)
select c.id, v.slug, v.name, v.icon, v.seo, 10, v.so, v.hdr from public.categories c,
 (values ('robux-gift-cards','Robux gift cards','credit-card','Roblox gift card codes with instant delivery.',1,true),
         ('roblox-top-up','Top up by username','user-plus','Robux sent straight to your Roblox username.',2,false),
         ('roblox-limited-items','Limited items','crown','Rare Roblox limited items.',3,false)) as v(slug,name,icon,seo,so,hdr)
where c.slug='roblox';

-- ===== SEED: offers (40) =====
create temporary table seed_tpl (n int, cat text, title text, img text, price int, old int, plat text, region text, dt public.delivery_type, kind text) on commit drop;
insert into seed_tpl values
 (1,'robux-gift-cards','Roblox Gift Card — Robux code','robux',164,199,'PC / Mobile','Global','auto_codes','robux'),
 (2,'robux-gift-cards','Roblox Digital Gift Card USD','robux',999,null,'PC / Mobile','US','auto_codes','usd'),
 (3,'robux-gift-cards','Robux Premium Gift Code','robux',549,650,'PC / Mobile','Global','auto_codes','robux'),
 (4,'roblox-top-up','Robux top-up by username','topup',149,null,'PC / Mobile','Global','manual','robux'),
 (5,'roblox-top-up','Fast Robux delivery to your account','topup',159,179,'PC / Mobile','Global','manual','robux'),
 (6,'roblox-top-up','Roblox Premium 450 top-up','topup',499,null,'PC / Mobile','Global','manual','none'),
 (7,'roblox-limited-items','Limited: Golden Crown of O''Malley','limited',8900,9900,'Roblox','Global','manual','limited'),
 (8,'roblox-limited-items','Limited: Emerald Valkyrie','limited',15400,null,'Roblox','Global','manual','limited'),
 (9,'playstation','PlayStation Store Wallet Card','console',1000,null,'PlayStation','US','auto_codes','usd'),
 (10,'playstation','PS Plus Essential membership','console',899,1099,'PlayStation','EU','auto_codes','months'),
 (11,'playstation','PSN Gift Card (UK)','console',2250,null,'PlayStation','UK','auto_codes','usd'),
 (12,'games','Indie game bundle Steam key','game',799,1499,'PC','Global','auto_codes','none'),
 (13,'software','Windows 11 Pro licence key','software',1499,19900,'Windows','Global','auto_codes','none'),
 (14,'software','Office 2021 Professional Plus','software',2499,4999,'Windows','Global','auto_codes','none'),
 (15,'software','Antivirus Total Security 1 year','software',1299,null,'Windows / macOS','Global','auto_codes','devices'),
 (16,'software','VPN Premium licence','software',399,599,'All devices','Global','auto_codes','months'),
 (17,'subscriptions','Music streaming Premium','subscription',549,999,'All devices','Global','manual','months'),
 (18,'subscriptions','Video streaming Standard plan','subscription',799,null,'All devices','Global','manual','months'),
 (19,'gift-cards','Digital shopping gift card','giftcard',1000,null,'Online','US','auto_codes','usd'),
 (20,'gift-cards','Game store gift card','giftcard',2000,2100,'PC','Global','auto_codes','usd');

do $$
declare
  t record; s record; new_id bigint; sellers uuid[] := array[
    '00000000-0000-4000-a000-000000000011'::uuid,'00000000-0000-4000-a000-000000000012'::uuid,'00000000-0000-4000-a000-000000000013'::uuid];
  i int; base int; sales int; slug text;
begin
  for t in select * from seed_tpl order by n loop
    for i in 0..1 loop
      base := t.price + i * (t.price / 12);
      sales := ((t.n * 7919 + i * 104729) % 23000);
      if t.n % 4 = 0 then sales := sales / 40; end if;
      slug := trim(both '-' from regexp_replace(lower(t.title), '[^a-z0-9]+', '-', 'g'));
      insert into public.offers (seller_id, category_id, slug, title, description, image_url, price_minor, old_price_minor,
        currency, delivery_type, stock_count, sales_count, status, region, platform, created_at)
      values (
        sellers[1 + ((t.n + i) % 3)],
        (select id from public.categories where categories.slug = t.cat),
        slug,
        t.title || case when i = 1 then ' — Instant' else '' end,
        'Genuine ' || t.title || '. ' ||
          case t.dt when 'auto_codes' then 'Your code is delivered automatically right after payment.'
                    else 'The seller completes delivery manually, usually within 15 minutes.' end ||
          E'\n\nRegion: ' || t.region || E'. Platform: ' || t.plat || E'.\n\nHow to redeem: follow the instructions sent with your order. Contact the seller from your order page if anything goes wrong.',
        '/images/offers/' || t.img || '.jpg',
        base,
        case when t.old is not null and i = 0 then t.old else null end,
        'USD', t.dt, 50 + sales % 400, sales, 'active', t.region, t.plat,
        now() - ((t.n * 3 + i) || ' days')::interval)
      returning id into new_id;

      if t.kind = 'robux' then
        insert into public.offer_options (offer_id, label, price_minor, sort_order) values
          (new_id,'80 Robux',base,1),(new_id,'160 Robux',base*2 - 10,2),(new_id,'500 Robux',base*6 - 50,3),(new_id,'1 000 Robux',base*12 - 150,4);
      elsif t.kind = 'usd' then
        insert into public.offer_options (offer_id, label, price_minor, sort_order) values
          (new_id,'$10',base,1),(new_id,'$25',base*25/10,2),(new_id,'$50',base*5,3);
      elsif t.kind = 'months' then
        insert into public.offer_options (offer_id, label, price_minor, sort_order) values
          (new_id,'1 month',base,1),(new_id,'3 months',base*27/10,2),(new_id,'12 months',base*10,3);
      elsif t.kind = 'devices' then
        insert into public.offer_options (offer_id, label, price_minor, sort_order) values
          (new_id,'1 device',base,1),(new_id,'3 devices',base*2,2),(new_id,'5 devices',base*3,3);
      end if;

      if t.cat in ('roblox-top-up','roblox-limited-items') then
        insert into public.offer_input_fields (offer_id, key, label, type, required, sort_order)
        values (new_id,'roblox_username','Roblox username','text',true,1);
      end if;
      if t.cat = 'playstation' then
        insert into public.offer_input_fields (offer_id, key, label, type, select_options, required, sort_order)
        values (new_id,'account_region','Account region','select',array['US','UK','EU'],true,1);
      end if;
      if t.cat = 'subscriptions' then
        insert into public.offer_input_fields (offer_id, key, label, type, required, sort_order)
        values (new_id,'account_email','Account email for activation','text',true,1);
      end if;
      if t.kind = 'limited' then
        insert into public.offer_input_fields (offer_id, key, label, type, required, sort_order)
        values (new_id,'quantity','Quantity','number',false,2);
      end if;
    end loop;
  end loop;
end $$;

insert into public.favorites (user_id, offer_id)
select '00000000-0000-4000-a000-000000000021', id from public.offers order by id limit 3;
