# Gaming Cafe Website — Customisable Starter

A mobile-friendly black/red gaming cafe website based on the visual direction in the Respawn Cafe screenshot you shared. It includes an editable cafe identity, game-station prices, cafe menu, photo uploads, opening hours, customer booking requests and a password-protected admin panel. No payment gateway is installed.

## What is included

- Five dedicated public page URLs with a shared responsive navbar: `/` (Home), `/gaming` (gaming stations and prices), `/cafe` (menu and prices), `/tournaments` (tournament landing page), and `/book` (reservation wizard). Clicking a navbar item navigates to that page, not just to a section on Home.
- Home includes the hero, combo-pass showcase, animated game gallery, and location/contact block. The `/track` booking-reference lookup and `/admin` management panel are separate pages too.
- Step-by-step booking: choose a setup, add an optional player/combo pass, up to 6 extra controllers and menu items, then choose duration, an individual station, date and available time slot.
- Promo control center in Admin → Branding & hours: toggle promotions ON/OFF, set a 0–100% discount, choose entire order/session/pass/extras scope, and edit the promotional headline. The server recalculates the discount on booking submission and stores a price snapshot for Admin and Track Order.
- Larger booking setup cards with larger image areas, readable duration prices, animated floating poster cards, a custom GTA V-inspired central poster, drifting light/orbit layers, and bouncing scroll arrows. Animations respect the operating system's reduced-motion preference.
- Customer booking fields: gamer name, phone/WhatsApp, optional email, schedule, optional notes, manual bKash/Nagad method, amount reported paid and optional transaction ID.
- Unique `RSC-...` booking references and a public `/track` page to look up reservation status and whether staff verified the reported payment.
- Admin can add unlimited separate gaming setups, choose each setup's station capacity, set prices, confirm/reject bookings and verify manual payments.
- Animated game gallery with three marquee rows: the top and bottom move in one direction while the middle moves in the opposite direction.
- A tournament landing page for FC, fighting-game and racing formats. Actual event dates/entry fees are intentionally not invented; confirm these with the cafe before publishing event details.
- Daily opening/closing time controls. Initial hours are **08:00 AM–12:00 AM (midnight)**.
- Server-side session validation: bookings must fit inside opening hours; a full station/time is not offered and is rechecked at submission.
- Station capacity, session durations, and prices are editable.
- Cafe menu items, categories, prices, descriptions and photos can be added/edited/hidden/deleted.
- Combo passes/bundles can be added, edited or deleted, including their inclusions, regular value and offer price.
- Admin can change the cafe name, tagline, address/contact info, logo, background photo, two featured game posters and the poster labels.
- Images uploaded through the admin panel are compressed in the browser and stored in the database, so they aren't lost just because the web app is redeployed (the database itself still needs persistent hosting).
- Booking states: Pending, Confirmed, Rejected, Cancelled. Confirmed and pending reservations hold their station/time; the schedule labels full slots as Booked or Pending.

The starter hero background points to the reference site’s own gamer photo; the two featured game-poster images are crops from the screenshot you supplied. The new central GTA V-inspired artwork is a custom illustration, not official game cover art. The starter food/drink items and their prices are examples to customise; the source website's full menu did not load as extractable text when this package was prepared. The bundle does not copy the original website's code.

## 1. Run locally on Windows

Install Python 3.11 or later. Extract this ZIP, open Command Prompt or PowerShell inside the extracted `gaming_cafe_website` folder, then run:

```bat
py -m venv .venv
.venv\Scripts\activate
python -m pip install -r requirements.txt
```

Before starting, set a private admin password. In **Command Prompt**:

```bat
set ADMIN_PASSWORD=choose-a-strong-password
set SECRET_KEY=make-this-a-long-random-secret
python app.py
```

In **PowerShell** use:

```powershell
$env:ADMIN_PASSWORD = "choose-a-strong-password"
$env:SECRET_KEY = "make-this-a-long-random-secret"
python app.py
```

Open these addresses:

- Public website: `http://127.0.0.1:5000`
- Admin panel: `http://127.0.0.1:5000/admin`

If you don't set `ADMIN_PASSWORD` locally, the starter password is `admin1234`. Change it before publishing the website. Local development uses SQLite at `instance/cafe.db`; back up that file to back up the local bookings and settings.

## 2. Use the admin panel

1. Open `/admin` and sign in.
2. **Branding & hours:** change the cafe name, tagline, address, phone, email, opening/closing time, logo and images.
3. **Gaming prices:** use **Add setup** to add as many gaming consoles/experiences as you need; edit each setup's station capacity, image and prices. Price format is `minutes=price`, separated by commas. Example: `30=150,60=220,120=440`.
4. **Cafe menu:** add an item, choose a category, set price, add a description and upload a picture.
5. **Combo passes:** configure bundle names, contents, regular prices and offer prices. Customers can add one pass in Step 2 of booking; the pass and its price are stored with the request.
6. **Promotions:** under **Branding & hours → Promo control center**, choose ON/OFF, a 0–100% discount, the discount scope (entire order/session/player pass/extras), and the promo headline. Default is OFF; booking totals are recalculated on the server.
7. **Manual payments:** enter the cafe's bKash and Nagad receiver numbers under **Branding & hours**. Customers can choose a method and report the amount and optional transaction ID. Verify the payment in your wallet before marking it **Verified**.
8. **Bookings:** set booking status and payment verification separately. Share `/track` with customers so they can search using their unique reference code.

Bookings are requests, not confirmed reservations, until an admin marks them Confirmed. bKash/Nagad are manual only: the site does not process money or verify a transaction automatically. Admin must check the wallet account before marking a reported payment Verified. There is no automatic email/SMS notification or customer login in this starter.

## 3. Deploy on Render

The root folder contains `render.yaml` so Render can recognise the Python web service. Push this folder to a GitHub repository, then create a Blueprint/Web Service in Render from that repository. Use these environment variables:

- `ADMIN_PASSWORD`: set a strong secret password. Do not leave the default.
- `SECRET_KEY`: use Render's generated secret (the Blueprint requests this automatically).
- `COOKIE_SECURE`: the Blueprint sets this to `true` for HTTPS-only admin session cookies.
- `DATABASE_URL`: **set this to a persistent PostgreSQL database connection string**. It may be from a PostgreSQL provider you already use, such as a separate database for this cafe.

`DATABASE_URL` is deliberately not hard-coded. On a hosted app, do not rely on the bundled SQLite default for real customer bookings: Render's free web services have ephemeral filesystems, so a local SQLite file can be lost on a restart/redeploy. Render's free Postgres databases also expire after 30 days, so check the database plan/retention rules before using one for ongoing business records. See Render's current [Free instance limitations](https://render.com/docs/free).

If you already use Supabase, you can use a PostgreSQL connection string from the Supabase dashboard as `DATABASE_URL` (use the connection option suitable for external app connections, and keep the password private). The app creates its own tables: `site_setting`, `game_setup`, `menu_item`, `combo_pass`, and `booking`. Test the booking flow before sharing the website publicly.

## 4. Opening hours and availability

The initial daily hours are 08:00 to 00:00. In **Branding & hours**, change opening and closing time when you need. Use `00:00` for midnight closing. The time list uses 30-minute start increments; available sessions must end before closing time. If two customers try to book the last slot at almost the same time, the server rechecks capacity when each request is submitted, but for a busy cafe you should still monitor the admin panel and use a properly maintained database.

## Notes before going live

- Replace the sample business name, contact details, location, menu items and prices.
- Set a strong `ADMIN_PASSWORD` and `SECRET_KEY`.
- Connect a persistent PostgreSQL database and test with a real booking before sharing the site.
- A request is only **Pending** on submission. Customer-reported payment amount / transaction ID must be checked manually; there is no payment gateway and the site does not automatically email/text customers.
- The built-in daily opening-hours setting applies every day; weekday-specific holidays/closures are not part of this first version.
