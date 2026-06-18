# SLOTIQ PRO — Контекст проекта

## Что это
Платформа для онлайн-записи к бизнесам (типа YClients но лучше).
Разрабатывается с октября 2025.

## Стек
- **Фронтенд:** React + Vite + Tailwind, порт 5173
- **Бэкенд:** Node.js + Express + PostgreSQL, порт 4000
- **Папка проекта:** C:\SLOTIQ1_FIXED\
  - frontend2\ — фронт
  - backend\ — бэк (server.js, routes\, db.js)

## Структура фронта (src\)
- business-panel\ — бизнес-панель (готова ✅)
- client-widget\SmartBooking\ — виджет онлайн-записи клиента
- ui\ — компоненты (Neo* — своя дизайн-система)
- api\ — все апи-вызовы
- helpers\AuthContext.jsx — авторизация

## Что готово ✅
- Вся бизнес-панель: Дашборд, Филиалы, Сотрудники, Услуги, Помещения, Расписание, Записи, Клиенты, Аналитика
- SmartBooking виджет (логика записи: шаг 1→2→3→4)
- Бэкенд роуты: employees, branches, services, rooms, bookings, clients, schedule, dashboard, analytics

## Что сделано в этой сессии
- [x] App.jsx исправлен — виджет вынесен на публичный роут /booking (без сайдбара, без авторизации)
  - Файл сохранён в outputs/App.jsx
  - Нужно скопировать в: frontend2\src\App.jsx

## Что делаем дальше (по приоритету)
1. [ ] Проверить что App.jsx применён и /booking открывается без сайдбара
2. [ ] Проверить end-to-end: запись через виджет → появляется в базе и в бизнес-панели
3. [ ] Починить server.js — подключить роуты auth, clientProfile, clientComments, clientHistory, clientStats
4. [ ] Убедиться что клиент создаётся в таблице clients при записи через виджет
5. [ ] Деплой или раздача ссылки для тестирования

## Критические баги (исправлено 13.05.2026)
- [x] server.js подключает: auth, clientProfile, clientComments, clientHistory, clientStats
- [x] auth.js использует process.env.JWT_SECRET из .env
- [x] Добавлена система тем (dark/light) через CSS custom properties + ThemeContext
- [x] Исправлен zoom-баг: min-width:0 на .neo-content, sidebar 220px, overflow-x: auto на таблицах
- [x] Все хардкоженные тёмные цвета в Bookings/Clients/Dashboard заменены на CSS vars
- [x] Статусные бейджи (booked/completed/cancelled/no_show) адаптированы под обе темы
- [x] ui.css, ui-kit.css, neo-table-base.css, neo-modal.css переведены на CSS переменные

## Данные в базе (на 13.05.2026)
- Филиалы: 5 (Дом, Мыло, Работа, Серый, Центр)
- Услуги: 4
- Сотрудники: 7
- Клиентов: 22
- Записей: 45

## Как начать новый чат
Просто скинь этот файл CONTEXT.md и напиши что делаем — я сразу в курсе.
