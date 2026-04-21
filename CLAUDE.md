# Техноточка — Система лояльности (Telegram Mini App)

## Контекст проекта
Комиссионный магазин техники. Система лояльности на базе Telegram Mini App.
Бот: @technobonusbot · Админ Telegram ID: 339860192

## Стек
- **Фронтенд**: Vanilla HTML + CSS + JS, один файл `index.html`, GitHub Pages
- **Бэкенд**: Google Apps Script (`Code.gs`), задеплоен как веб-приложение
- **База данных**: Google Sheets (3 листа: Клиенты, Продажи, Сотрудники)
- **Авторизация**: Telegram.WebApp.initDataUnsafe.user.id

## Роли (определяются по Telegram ID через API)
- **Клиент** — баланс баллов, уровень, история покупок, QR-код
- **Сотрудник** — поиск клиента, оформление продажи, реферальная ссылка
- **Администратор** — статистика, рейтинг сотрудников, управление командой

## Механика баллов
- Уровень «Новый» (0–10 000 ₽/год) → кешбэк 3%
- Уровень «Постоянный» (10 000–40 000 ₽/год) → кешбэк 5%
- Уровень «Свой» (от 40 000 ₽/год) → кешбэк 7%
- Списание: до 15% от суммы покупки · 1 балл = 1 рубль

## Структура Google Sheets
**Клиенты**: tg_id, fio, phone, qr_code, balance, total_year, tier, referred_by, created_at  
**Продажи**: sale_id, client_tg_id, staff_tg_id, amount, points_earned, points_redeemed, created_at  
**Сотрудники**: tg_id, name, role, ref_code, city, created_at

## API (Google Apps Script)
Все запросы — POST на константу `API_URL` в `index.html`.
Параметр `action` определяет действие:
- `ping` — проверка работы
- `getRole` — получить роль по tg_id
- `getClient` — данные клиента + история
- `registerClient` — регистрация нового клиента
- `searchClient` — поиск по ФИО / телефону
- `getClientById` — найти клиента по tg_id (для сотрудника после сканирования QR)
- `addSale` — оформить продажу и начислить баллы
- `getAdminStats` — статистика для администратора
- `getStaffList` — список сотрудников с показателями
- `addStaff` — добавить сотрудника
- `removeStaff` — удалить сотрудника

## Дизайн
Тёмная тема, мобильный first, нативный стиль Telegram.
- Фон: `#0f1623`
- Акцент: `#3b82f6`
- Поверхности: `#1d2a3a`
- Текст: `#ffffff` / `#8aa4bf`
- Радиус: 12px, шрифт: system-ui

## Файлы проекта
- `index.html` — весь Mini App
- `Code.gs` — бэкенд (не изменять без необходимости)
- `README.md` — инструкция по деплою
- `CLAUDE.md` — этот файл, контекст для Claude Code

## Важные правила
- `Code.gs` уже готов и задеплоен — не пересоздавать
- В `index.html` константа `API_URL` должна быть пустой строкой `''` до деплоя Apps Script
- QR-код генерировать через `qrcode.min.js` (cdn.jsdelivr.net)
- Сканирование QR — через `Telegram.WebApp.showScanQrPopup()`
- Реферальная ссылка сотрудника: `https://t.me/technobonusbot?start=staff_[tg_id]`