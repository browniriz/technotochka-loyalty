// ============================================================
//  Техноточка — Система лояльности
//  Google Apps Script · Версия 1.0
//  Бот: @technobonusbot · Админ ID: 339860192
// ============================================================

const SS = SpreadsheetApp.getActiveSpreadsheet();

const SHEETS = {
  clients:  () => SS.getSheetByName('Клиенты'),
  sales:    () => SS.getSheetByName('Продажи'),
  staff:    () => SS.getSheetByName('Сотрудники'),
};

const BOT_USERNAME = 'technobonusbot';

const TIERS = [
  { name: 'Новый',      min: 0,     max: 10000,    pct: 3 },
  { name: 'Постоянный', min: 10000, max: 40000,    pct: 5 },
  { name: 'Свой',       min: 40000, max: Infinity, pct: 7 },
];

function doPost(e) {
  try {
    let body;
    if (e.postData && e.postData.type === 'application/json') {
      body = JSON.parse(e.postData.contents);
    } else if (e.parameter && e.parameter.data) {
      body = JSON.parse(e.parameter.data);
    } else if (e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    } else {
      return jsonResponse({ error: 'Нет данных в запросе' });
    }
    const action = body.action;
    const tgId   = String(body.tg_id || '');
    let result;
    if      (action === 'ping')           result = { status: 'ok' };
    else if (action === 'getRole')        result = getRole(tgId);
    else if (action === 'getClient')      result = getClient(tgId);
    else if (action === 'registerClient') result = registerClient(body);
    else if (action === 'searchClient')   result = searchClient(body.query);
    else if (action === 'getClientById')  result = getClientByTgId(String(body.client_tg_id));
    else if (action === 'addSale')        result = addSale(body, tgId);
    else if (action === 'getAdminStats')  result = getAdminStats();
    else if (action === 'getStaffList')   result = getStaffList();
    else if (action === 'addStaff')       result = addStaff(body);
    else if (action === 'removeStaff')    result = removeStaff(String(body.staff_tg_id));
    else result = { error: 'Неизвестное действие: ' + action };
    return jsonResponse(result);
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function doGet(e) {
  try {
    if (e.parameter && e.parameter.data) {
      const body = JSON.parse(e.parameter.data);
      const action = body.action;
      const tgId = String(body.tg_id || '');
      let result;
      if      (action === 'ping')           result = { status: 'ok' };
      else if (action === 'getRole')        result = getRole(tgId);
      else if (action === 'getClient')      result = getClient(tgId);
      else if (action === 'registerClient') result = registerClient(body);
      else if (action === 'searchClient')   result = searchClient(body.query);
      else if (action === 'getClientById')  result = getClientByTgId(String(body.client_tg_id));
      else if (action === 'addSale')        result = addSale(body, tgId);
      else if (action === 'getAdminStats')  result = getAdminStats();
      else if (action === 'getStaffList')   result = getStaffList();
      else if (action === 'addStaff')       result = addStaff(body);
      else if (action === 'removeStaff')    result = removeStaff(String(body.staff_tg_id));
      else result = { error: 'Неизвестное действие: ' + action };
      return jsonResponse(result);
    }
    return jsonResponse({ status: 'ok', hint: 'Используй запросы с параметром data' });
  } catch (err) {
    return jsonResponse({ error: err.toString() });
  }
}

function getRole(tgId) {
  const row = findStaffRow(tgId);
  if (!row) return { role: 'client' };
  return { role: row[2] || 'staff' };
}

function getClient(tgId) {
  const sheet = SHEETS.clients();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === tgId) {
      const client = rowToClient(data[i]);
      client.history = getSalesHistory(tgId);
      return { found: true, client };
    }
  }
  return { found: false };
}

function getClientByTgId(tgId) {
  const sheet = SHEETS.clients();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === tgId) return { found: true, client: rowToClient(data[i]) };
  }
  return { found: false };
}

function registerClient(body) {
  const tgId    = String(body.tg_id);
  const existing = getClient(tgId);
  if (existing.found) return { success: true, client: existing.client, already_exists: true };
  const sheet = SHEETS.clients();
  sheet.appendRow([tgId, body.fio || '', body.phone || '', tgId, 0, 0,
    TIERS[0].name, body.referred_by ? String(body.referred_by) : '', formatDate(new Date())]);
  return { success: true, client: getClient(tgId).client };
}

function searchClient(query) {
  if (!query || query.length < 2) return { results: [] };
  const sheet = SHEETS.clients();
  const data  = sheet.getDataRange().getValues();
  const q     = query.toLowerCase();
  const results = [];
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][1]||'').toLowerCase().includes(q) ||
        String(data[i][2]||'').toLowerCase().includes(q) ||
        String(data[i][0]||'').toLowerCase().includes(q)) {
      results.push(rowToClient(data[i]));
      if (results.length >= 10) break;
    }
  }
  return { results };
}

function rowToClient(row) {
  return {
    tg_id:       String(row[0]),
    fio:         row[1]  || '',
    phone:       row[2]  || '',
    qr_code:     String(row[3] || row[0]),
    balance:     Number(row[4]) || 0,
    total_year:  Number(row[5]) || 0,
    tier:        row[6]  || TIERS[0].name,
    referred_by: String(row[7] || ''),
    created_at:  row[8]  || '',
  };
}

function addSale(body, staffTgId) {
  const clientTgId = String(body.client_tg_id);
  const amount     = Number(body.amount) || 0;
  const redeemed   = Number(body.points_redeemed) || 0;
  if (amount <= 0) return { error: 'Сумма должна быть больше 0' };

  const clientSheet = SHEETS.clients();
  const clientData  = clientSheet.getDataRange().getValues();
  let clientRowIdx  = -1;
  for (let i = 1; i < clientData.length; i++) {
    if (String(clientData[i][0]) === clientTgId) { clientRowIdx = i; break; }
  }
  if (clientRowIdx === -1) return { error: 'Клиент не найден' };

  const currentBalance   = Number(clientData[clientRowIdx][4]) || 0;
  const currentTotalYear = Number(clientData[clientRowIdx][5]) || 0;
  const clientTier       = getTierByTotal(currentTotalYear);
  const earned           = Math.round(amount * clientTier.pct / 100);
  const actualRedeemed   = Math.min(redeemed, Math.floor(amount * 0.15), currentBalance);
  const newBalance       = currentBalance - actualRedeemed + earned;
  const newTotalYear     = currentTotalYear + amount;
  const newTier          = getTierByTotal(newTotalYear).name;
  const clientRow        = clientRowIdx + 1;

  clientSheet.getRange(clientRow, 5).setValue(newBalance);
  clientSheet.getRange(clientRow, 6).setValue(newTotalYear);
  clientSheet.getRange(clientRow, 7).setValue(newTier);
  SHEETS.sales().appendRow([new Date().getTime().toString(), clientTgId, staffTgId,
    amount, earned, actualRedeemed, formatDate(new Date())]);

  return { success: true, sale: { amount, points_earned: earned,
    points_redeemed: actualRedeemed, new_balance: newBalance,
    new_tier: newTier, tier_pct: clientTier.pct } };
}

function getSalesHistory(tgId) {
  const sheet = SHEETS.sales();
  const data  = sheet.getDataRange().getValues();
  const history = [];
  for (let i = data.length - 1; i >= 1; i--) {
    if (String(data[i][1]) === tgId) {
      history.push({ sale_id: String(data[i][0]), amount: Number(data[i][3]),
        points_earned: Number(data[i][4]), points_redeemed: Number(data[i][5]), date: data[i][6] || '' });
      if (history.length >= 20) break;
    }
  }
  return history;
}

function getAdminStats() {
  const clients = SHEETS.clients().getDataRange().getValues();
  const sales   = SHEETS.sales().getDataRange().getValues();
  const now = new Date();
  let monthSales = 0, monthAmount = 0, totalPoints = 0;
  for (let i = 1; i < sales.length; i++) {
    const d      = new Date(String(sales[i][6] || ''));
    const earned = Number(sales[i][4]) || 0;
    totalPoints += earned;
    if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
      monthSales++;
      monthAmount += Number(sales[i][3]) || 0;
    }
  }
  const tierCount = { 'Новый': 0, 'Постоянный': 0, 'Свой': 0 };
  for (let i = 1; i < clients.length; i++) {
    const t = clients[i][6] || 'Новый';
    if (tierCount[t] !== undefined) tierCount[t]++;
  }
  return { total_clients: clients.length - 1, month_sales_count: monthSales,
    month_sales_amount: Math.round(monthAmount), total_points_issued: totalPoints, tiers: tierCount };
}

function getStaffList() {
  const staffData  = SHEETS.staff().getDataRange().getValues();
  const salesData  = SHEETS.sales().getDataRange().getValues();
  const clientData = SHEETS.clients().getDataRange().getValues();
  const now  = new Date();
  const list = [];
  for (let i = 1; i < staffData.length; i++) {
    const tgId = String(staffData[i][0]);
    let salesCount = 0, salesAmount = 0, invitedCount = 0;
    for (let j = 1; j < salesData.length; j++) {
      if (String(salesData[j][2]) === tgId) {
        const d = new Date(String(salesData[j][6] || ''));
        if (d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()) {
          salesCount++;
          salesAmount += Number(salesData[j][3]) || 0;
        }
      }
    }
    for (let k = 1; k < clientData.length; k++) {
      if (String(clientData[k][7]) === tgId) invitedCount++;
    }
    list.push({ tg_id: tgId, name: staffData[i][1] || '', role: staffData[i][2] || 'staff',
      ref_code: staffData[i][3] || '', city: staffData[i][4] || '',
      month_sales_count: salesCount, month_sales_amount: Math.round(salesAmount),
      invited_clients: invitedCount });
  }
  list.sort((a, b) => b.month_sales_amount - a.month_sales_amount);
  return { staff: list };
}

function addStaff(body) {
  const tgId = String(body.tg_id);
  if (findStaffRow(tgId)) return { error: 'Сотрудник уже существует' };
  SHEETS.staff().appendRow([tgId, body.name || '', body.role || 'staff',
    'staff_' + tgId, body.city || '', formatDate(new Date())]);
  return { success: true };
}

function removeStaff(tgId) {
  const sheet = SHEETS.staff();
  const data  = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === tgId) { sheet.deleteRow(i + 1); return { success: true }; }
  }
  return { error: 'Сотрудник не найден' };
}

function getTierByTotal(total) {
  for (let i = TIERS.length - 1; i >= 0; i--) {
    if (total >= TIERS[i].min) return TIERS[i];
  }
  return TIERS[0];
}

function findStaffRow(tgId) {
  const data = SHEETS.staff().getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === tgId) return data[i];
  }
  return null;
}

function formatDate(d) {
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'dd.MM.yyyy HH:mm');
}

function jsonResponse(obj) {
  const output = ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}
