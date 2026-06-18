# SLOTIQ_PRO_FIXED  
Многофункциональная CRM + система онлайн-бронирования  
для школ, салонов, студий, репетиционных пространств, фитнеса, аренды и услуг.

SLOTIQ PRO — это SaaS-платформа, которая объединяет:
- управление филиалами и помещениями  
- учёт сотрудников и услуг  
- создание и ведение клиентской базы  
- расписание и онлайн-записи  
- аналитику по загрузке и выручке  
- интерфейс администратора и клиентский виджет

---

# 🚀 Стек технологий

### **Backend**
- Node.js + Express
- SQLite (быстрая, файловая, без установки)
- лучшее ORM-поведение через prepared statements
- REST API

### **Frontend**
- React + Vite
- Tailwind CSS
- Recharts (графики аналитики)

---

# 📂 Структура проекта

SLOTIQ_PRO_FIXED/
|
|-- backend/
| |-- server.js
| |-- init_db.js
| |-- db.js
| |-- routes/
| branches.js
| rooms.js
| employees.js
| services.js
| clients.js
| bookings.js
|
|-- frontend2/
|-- src/
|-- App.jsx
|-- business-panel/
Dashboard.jsx
Branches.jsx
Rooms.jsx
Employees.jsx
Services.jsx
Clients.jsx
Bookings.jsx
Analytics.jsx
components/
AddModal.jsx

---

# 🔌 Установка и запуск

## 1️⃣ Установка зависимостей

### Backend:
cd backend
npm install

### Frontend:
cd frontend2
npm install

---

# 🗄 2️⃣ Инициализация базы данных

SQLite создаётся автоматически.

Запустить полную инициализацию:
cd backend
node init_db.js

Создаются таблицы:

### Основные:
- branches  
- rooms  
- employees  
- services  
- clients  
- bookings  

### Many-to-many:
- rooms_branches  
- employees_branches  
- services_branches  

---

# ▶️ 3️⃣ Запуск backend

cd backend
node server.js

Сервер стартует на:

👉 **http://localhost:4000**

---

# 💻 4️⃣ Запуск frontend
cd frontend2
npm run dev

Открыть в браузере:

👉 **http://localhost:5173**

---

# 🧭 Панель администратора (Dashboard)

SLOTIQ PRO состоит из 7 модулей:

### 1. **Филиалы**
Добавление, редактирование, удаление филиалов.

### 2. **Помещения**
Поддержка нескольких филиалов на одно помещение.  
Связь many-to-many.

### 3. **Сотрудники**
Один сотрудник может работать в нескольких филиалах.  
Связь many-to-many.

### 4. **Услуги**
Услуги могут повторяться в разных филиалах.  
Связь many-to-many.

### 5. **Клиенты**
База клиентов: имя, телефон, email.  
Удаление клиента удаляет все его брони.

### 6. **Брони**
В одной записи соединяются:
- клиент  
- филиал  
- сотрудник  
- услуга  
- помещение  
- дата  
- время  
- статус  

### 7. **Аналитика**
- брони по филиалам  
- загрузка сотрудников  
- выручка по услугам  

Основано на Recharts:
- BarChart
- PieChart
- ResponsiveContainer

---

# 🔗 API (кратко)

### Филиалы
GET /api/branches
POST /api/branches
PUT /api/branches/:id
DELETE /api/branches/:id

### Помещения
GET /api/rooms
POST /api/rooms
PUT /api/rooms/:id
DELETE /api/rooms/:id

### Сотрудники
GET /api/employees
POST /api/employees
PUT /api/employees/:id
DELETE /api/employees/:id

### Услуги
GET /api/services
POST /api/services
PUT /api/services/:id
DELETE /api/services/:id

### Клиенты
GET /api/clients
POST /api/clients
PUT /api/clients/:id
DELETE /api/clients/:id

### Брони
GET /api/bookings
POST /api/bookings
PUT /api/bookings/:id
DELETE /api/bookings/:id

---

# 🎨 UI / UX

- Фирменный градиент: `#3ACFD5 → #6558F5`
- Белые карточки
- Закругления: `rounded-2xl`
- Модалки — универсальные (`AddModal.jsx`)
- Полная поддержка:
  - `text`
  - `select`
  - `multiselect`
  - `date`
  - `time`
  - `number`

---

# 📦 Build (Frontend)

cd frontend2
npm run build

Собирается в папку `dist/`.

Можно раздавать через Nginx, Apache, или GitHub Pages.

---

# 🤝 Лицензия
Проект личный. Используется в экосистеме Ёлки.  
Не предназначен для свободного копирования.

---

# 🧚 Автор
**Ёлка / Юлия Мальцева** — основатель, директор школы, антикоуч, CTO своей жизни.

Создано вместе с твоим домашним Фрэнки ❤️  




