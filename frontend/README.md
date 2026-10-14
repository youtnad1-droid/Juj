# Find My Digital Gems

Build the foundation of a multi-vendor digital goods marketplace called {BRAND}. Use your default full-stack setup (React frontend, backend API, database). This is phase 1 of 8, so build only what is listed here and keep the code clean so later phases can be added.



ROLES: guest, buyer, seller, admin. Registration, login, logout, forgot/reset password, email verification. Admin can be created by a seed script.



DATABASE (create now):

- users (email, password_hash, role, status, locale, currency, theme)

- seller_profiles (user_id, display_name, bio, country, verification_status, rating_avg, rating_count, sales_count)

- categories (parent_id, slug, name, icon, seo_text, commission_percent, sort_order, show_in_header, is_active), a tree of any depth

- offers (seller_id, category_id, slug, title, description, image_url, price_minor as integer cents, old_price_minor optional, currency, delivery_type auto_codes|manual, stock_count, sales_count, status, region, platform)

- offer_options (offer_id, label, price_minor, sort_order), e.g. 80 / 160 / 500 Robux

- offer_input_fields (offer_id, key, label, type text|select|number, required). Never allow a password type.

- favorites (user_id, offer_id)



SEED DATA: category tree Games > Roblox > (Robux gift cards, Top up by username, Limited items), Games > PlayStation, Software, Subscriptions, Gift cards. 3 sellers, about 40 offers with options and images, 2 buyers, 1 admin. Show prices in USD, e.g. "$1.64".



STOREFRONT PAGES (read-only for now):

1. Header: logo, "Start selling" link, Catalog menu (category tree), search bar, quick-link chips for hot categories (from categories where show_in_header), Favorites, Orders, Login or profile menu (My orders, Favorites, theme toggle). Footer: Partners, Buyers, Company link groups and a support email.

2. Home: quick-link chips, category tiles, "Popular offers" grid with a "Show more" button (load more, not page numbers).

3. Category page: breadcrumb, title, offer count, sub-category chips with "Show all", sort by price, offers grid with "Show more".

4. Offer card: square image, price (old price struck through if set), title, sales count shown as buckets ("100+", "1 000+", exact number above 10 000), Buy button.

5. Offer page: breadcrumb of the category path, image, title, option dropdown that updates the price, the offer's input fields, "About the product" description, seller card (name linking to seller page, rating, review count, total sales), a trust box: "Your money is held by the platform until you receive the item. We refund if it is not received or does not match the description.", Buy button (disabled placeholder for now), Add to favorites (works for logged-in users).

6. Seller public page: name, rating, sales, member since, their active offers.

7. Search: results page by title, with category filter.

8. Light, dark and system theme. Mobile-first responsive layout.



URLS: /catalog/:categorySlug and /catalog/product/:slug-:id.



API: REST endpoints for categories tree, offers list (filters, sort, load-more cursor), offer detail, seller detail, search, favorites add/remove/list, auth.



RULES: store money as integers. Validate all inputs. Hash passwords. Add rate limiting on login. Do not build checkout, payments, seller cabinet or admin yet.



When finished, give me the list of pages, the seed accounts (admin, seller, buyer) and how to run it.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b66e3539-3582-4530-a036-27b028861e6a).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
