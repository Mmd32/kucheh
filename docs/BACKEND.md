# ساختار اختیاری بک‌اند

اپ فعلاً کاملاً استاتیک است: هیچ سروری لازم نیست و همه‌ی بازی‌ها، آمار و ذخیره‌ی نیمه‌تمام در `localStorage` مرورگر می‌مانند. این سند ساختاری است برای وقتی که بخواهید بخش آنلاین یا حساب کاربری اضافه شود، بدون اینکه معماری فعلی خراب شود.

## لایه‌بندی پیشنهادی

```
api/
  app.js            # راه‌اندازی HTTP (Express/Fastify/Hono)
  routes/
    auth.js         # ورود/خروج
    profile.js      # پروفایل و تنظیمات
    scores.js       # آمار و جدول امتیازات
    saves.js        # همگام‌سازی وضعیت بازی‌ها
  services/
    scoreService.js
    saveService.js
    authService.js
  db/
    schema.sql      # بازی‌ها، بازیکن‌ها، رکوردها، ذخیره‌ها
    migrations/
  lib/
    validate.js     # اعتبارسنجی ورودی با Zod
    rateLimit.js
    session.js
```

سمت کلاینت فقط یک لایه‌ی نازک اضافه می‌شود:

```
src/core/api.js   # fetch + توست خطا
src/core/sync.js  # صف آفلاین و همگام‌سازی
```

## تصمیم‌های کلیدی

- **آفلاین‌اول:** هر بازی همچنان بدون شبکه کامل کار می‌کند. نوشتن‌ها اول در `localStorage` و صف می‌شوند، بعد در پس‌زمینه به `POST /api/sync` می‌روند.
- **بدون رمز عبور در کلاینت:** فقط شناسه‌ی نشست در کوکی HttpOnly نگهداری می‌شود.
- **آمار فقط خواندنی برای عموم:** `GET /api/scores?game=chess` برای جدول امتیازات؛ نوشتن از سرور و بعد از اعتبارسنجی نتیجه انجام می‌شود.
- **ذخیره‌ی وضعیت:** `PUT /api/saves/:gameId` با بدنه‌ی JSON محدود (حداکثر ۳۲KB) و نسخه‌بندی `schemaVersion`.
- **شناسه‌ها:** UUID نسخه ۷ برای رکوردها؛ هیچ شناسه‌ی قابل حدس در URL نباشد.

## جدول‌های پیشنهادی

```sql
create table players (
  id uuid primary key,
  handle text unique not null,
  display_name text not null,
  created_at timestamptz default now()
);

create table matches (
  id uuid primary key,
  game_id text not null,
  player_id uuid references players(id),
  result text check (result in ('win','loss','draw')),
  score int,
  duration_seconds int,
  played_at timestamptz default now()
);

create table saves (
  player_id uuid references players(id),
  game_id text not null,
  payload jsonb not null,
  schema_version int not null,
  updated_at timestamptz default now(),
  primary key (player_id, game_id)
);
```

## API پیشنهادی

| متد | مسیر | کار |
| --- | --- | --- |
| POST | `/api/auth/session` | ورود با کد یک‌بارمصرف |
| GET | `/api/profile` | پروفایل و تنظیمات |
| POST | `/api/matches` | ثبت نتیجه‌ی یک بازی |
| GET | `/api/scores` | جدول امتیازات به تفکیک بازی |
| GET | `/api/saves/:gameId` | خواندن ذخیره |
| PUT | `/api/saves/:gameId` | نوشتن ذخیره |
| POST | `/api/sync` | ارسال دسته‌ای رکوردهای آفلاین |

## چه چیزی عوض نمی‌شود

- موتور بازی‌ها (`src/games/*/engine.js`) دست نمی‌خورد؛ همان‌طور که تست می‌شود، در سرور هم قابل استفاده است.
- هیچ منطق بازی به سرور منتقل نمی‌شود؛ سرور فقط نتیجه و ذخیره را نگه می‌دارد تا تقلب در آمار ساده بماند.

## احراز هویت دو مرحله‌ای (2FA)

اپ فعلی حساب کاربری ندارد، پس ۲FA هم ندارد. اگر روزی حساب اضافه شد، ترتیب پیشنهادی این است:

1. **ورود بدون رمز با لینک یک‌بارمصرف ایمیل** — بیشترین امنیت با کمترین دردسر؛ اگر لینک کوتاه‌عمر و یک‌بارمصرف باشد، ۲FA جداگانه لازم نیست.
2. **TOTP** (Google Authenticator و مشابه) برای کسانی که رمز عبور می‌خواهند: راز TOTP فقط در سرور، کد پشتیبان یک‌بارمصرف، محدودیت تلاش و قفل موقت.
3. **WebAuthn/Passkey** به‌عنوان روش اصلی و توصیه‌شده؛ هیچ راز مشترکی بین کلاینت و سرور رد و بدل نمی‌شود.
4. **بازیابی حساب** باید از قبل تعریف شود (کد پشتیبان، ایمیل دوم) وگرنه کاربر قفل می‌شود.

قواعد پیاده‌سازی: نشست در کوکی `HttpOnly; Secure; SameSite=Lax`، چرخش شناسه‌ی نشست بعد از ورود، محدودیت نرخ روی مسیرهای ورود، لاگ بدون داده‌ی حساس، و هرگز نگه‌داشتن راز TOTP به‌صورت متن ساده.
