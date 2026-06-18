/**
 * SLOTIQ PRO — FULL API TEST SCRIPT
 * --------------------------------
 * Проверяет все ключевые эндпоинты backend:
 * branches, rooms, employees, services, schedule, dashboard
 *
 * Запуск:
 *   npm install axios
 *   node test_check.js
 */

import axios from "axios";

const API = "http://localhost:4000/api";

const log = (title, msg = "") =>
  console.log(`\x1b[36m${title}\x1b[0m ${msg}`);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function runTests() {
  console.log("🚀 START SLOTIQ PRO TEST\n");

  try {
    // 1️⃣ Проверка здоровья
    const health = await axios.get(`${API}/health`);
    log("✅ Health:", health.data.status);

    // 2️⃣ Добавляем филиал
    const newBranch = await axios.post(`${API}/branches`, {
      name: "Тестовый филиал",
      address: "ул. Ленина, 10",
      phone: "+7 (900) 000-00-00",
      start_time: "09:00",
      end_time: "21:00",
    });
    const branchId = newBranch.data.id;
    log("🏢 Branch created:", `ID ${branchId}`);

    // 3️⃣ Добавляем сотрудника
    const newEmployee = await axios.post(`${API}/employees`, {
      name: "Иван Иванов",
      phone: "+7 (900) 111-22-33",
      position: "Мастер маникюра",
      email: "ivan@slotiq.pro",
      branch_ids: [branchId],
    });
    const empId = newEmployee.data.id;
    log("👩‍🔧 Employee added:", `ID ${empId}`);

    // 4️⃣ Добавляем услугу
    const newService = await axios.post(`${API}/services`, {
      name: "Маникюр классический",
      price: 1200,
      duration: 60,
      branch_ids: [branchId],
      employee_ids: [empId],
    });
    const servId = newService.data.id;
    log("💅 Service added:", `ID ${servId}`);

    // 5️⃣ Добавляем помещение
    const newRoom = await axios.post(`${API}/rooms`, {
      name: "Кабинет №1",
      branch_id: branchId,
      type: "маникюр",
    });
    const roomId = newRoom.data.id;
    log("🏠 Room created:", `ID ${roomId}`);

    // 6️⃣ Добавляем смену
    const today = new Date().toISOString().slice(0, 10);
    const newShift = await axios.post(`${API}/schedule`, {
      employee_id: empId,
      branch_id: branchId,
      date: today,
      start_time: "10:00",
      end_time: "18:00",
    });
    log("🗓️ Shift created:", `for ${today}`);

    // 7️⃣ Проверяем список смен
    const scheduleList = await axios.get(`${API}/schedule`, {
      params: { branch_id: branchId },
    });
    log("📆 Schedule loaded:", `${scheduleList.data.length} entries`);

    // 8️⃣ Проверяем аналитику
    const dashboard = await axios.get(`${API}/dashboard`);
    log("📊 Dashboard:", dashboard.data ? "OK" : "Empty");

    // 9️⃣ Удаляем тестовые данные
    await axios.delete(`${API}/schedule/${scheduleList.data[0].id}`);
    await axios.delete(`${API}/rooms/${roomId}`);
    await axios.delete(`${API}/services/${servId}`);
    await axios.delete(`${API}/employees/${empId}`);
    await axios.delete(`${API}/branches/${branchId}`);
    log("🧹 Cleanup:", "All test data removed");

    console.log("\n✅ ALL TESTS PASSED SUCCESSFULLY");
  } catch (err) {
    console.error("❌ ERROR:", err.response?.data || err.message);
  }
}

runTests();
