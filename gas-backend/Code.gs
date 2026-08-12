/**
 * Crunch Cart Magic – Google Apps Script Backend
 *
 * Sheet tab names expected:
 *   users            → id | username | password | display_name | role
 *   product_variants → id | variant | size | filling | celup | tabur | price_normal | price_kuantar
 *   orders           → order_id | payment_method | price_tier | total | created_by | created_at
 *   order_items      → id | order_id | product_id | quantity | unit_price | line_total | variant_id | size | filling | celup | tabur | variant_name
 *
 * HOW TO DEPLOY:
 *  1. Open your Google Apps Script project (script.google.com)
 *  2. Replace the entire content of Code.gs with this file
 *  3. Click Deploy > Manage Deployments > Edit (pencil icon on the existing deployment)
 *  4. Change version to "New version", click Deploy
 *  5. The exec URL stays the same – no frontend changes needed
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/** Convert a sheet's data range to an array of plain objects keyed by header row. */
function sheetToObjects(sheetName) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(sheetName);
  if (!sheet) throw new Error('Sheet not found: ' + sheetName);
  var data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];   // header-only or empty
  var headers = data[0].map(function(h) { return String(h).trim(); });
  return data.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });
}

// ─── doGet ───────────────────────────────────────────────────────────────────

function doGet(e) {
  var type = (e.parameter && e.parameter.type) ? e.parameter.type : '';

  try {
    if (type === 'catalog') {
      return getCatalog();
    } else if (type === 'transactions') {
      return getTransactions();
    } else {
      // Default (no type param) → return users – used by the login screen
      return getUsers();
    }
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

function getUsers() {
  var rows = sheetToObjects('users');
  return jsonResponse(rows);
}

function getCatalog() {
  var rows = sheetToObjects('product_variants');
  // Cast numeric columns so they arrive as numbers, not strings
  var catalog = rows.map(function(r) {
    return {
      id:            Number(r.id)            || 0,
      variant:       String(r.variant        || '').trim(),
      size:          String(r.size           || '').trim(),
      filling:       String(r.filling        || '').trim() || null,
      celup:         String(r.celup          || '').trim() || null,
      tabur:         String(r.tabur          || '').trim() || null,
      price_normal:  Number(r.price_normal)  || 0,
      price_kuantar: Number(r.price_kuantar) || 0,
    };
  });
  return jsonResponse(catalog);
}

function getTransactions() {
  var orders = sheetToObjects('orders');
  var items  = sheetToObjects('order_items');

  var txMap = {};
  orders.forEach(function(o) {
    txMap[o.order_id] = {
      id:            o.order_id,
      timestamp:     o.created_at,
      paymentMethod: o.payment_method,
      priceTier:     o.price_tier,
      grandTotal:    Number(o.total) || 0,
      subtotal:      Number(o.total) || 0,
      created_by:    o.created_by,
      items:         [],
    };
  });

  items.forEach(function(item) {
    if (txMap[item.order_id]) {
      txMap[item.order_id].items.push({
        id:          item.id,
        variantId:   item.variant_id,
        variantName: item.variant_name,
        size:        item.size,
        filling:     item.filling  || undefined,
        celup:       item.celup    || undefined,
        tabur:       item.tabur    || undefined,
        quantity:    Number(item.quantity)   || 0,
        unitPrice:   Number(item.unit_price) || 0,
        priceTier:   item.price_tier,
        productId:   Number(item.product_id) || 0,
      });
    }
  });

  return jsonResponse(Object.values(txMap));
}

// ─── doPost ──────────────────────────────────────────────────────────────────

function doPost(e) {
  try {
    var rawPayload = e.parameter && e.parameter.payload
      ? e.parameter.payload
      : (e.postData ? e.postData.contents : '{}');

    var payload = JSON.parse(rawPayload);

    if (payload.type === 'update_prices') {
      return updatePrices(payload.prices);
    } else if (payload.order && payload.items) {
      return saveOrder(payload);
    } else {
      return jsonResponse({ error: 'Invalid payload' });
    }
  } catch (err) {
    return jsonResponse({ error: String(err) });
  }
}

function saveOrder(payload) {
  var ss     = SpreadsheetApp.getActiveSpreadsheet();
  var orders = ss.getSheetByName('orders');
  var items  = ss.getSheetByName('order_items');

  if (!orders || !items) {
    return jsonResponse({ error: 'orders or order_items sheet not found' });
  }

  // Generate a simple order number: ORD-YYYYMMDD-NNNN
  var now      = new Date();
  var datePart = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd');
  var count    = orders.getLastRow(); // simple incrementing suffix
  var orderId  = 'ORD-' + datePart + '-' + String(count + 1).padStart(4, '0');

  var o = payload.order;
  orders.appendRow([
    orderId,
    o.payment_method,
    o.price_tier,
    o.total,
    o.created_by,
    o.created_at || new Date().toISOString(),
  ]);

  payload.items.forEach(function(item, idx) {
    items.appendRow([
      orderId + '-' + (idx + 1),
      orderId,
      item.product_id,
      item.quantity,
      item.unit_price,
      item.line_total,
      item.variant_id,
      item.size,
      item.filling  || '',
      item.celup    || '',
      item.tabur    || '',
      item.variant_name,
    ]);
  });

  return jsonResponse({ success: true, orderNumber: orderId });
}

function updatePrices(rows) {
  var ss    = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('product_variants');
  if (!sheet) return jsonResponse({ error: 'product_variants sheet not found' });

  var data    = sheet.getDataRange().getValues();
  var headers = data[0].map(function(h) { return String(h).trim(); });
  var idCol   = headers.indexOf('id');
  var normalCol  = headers.indexOf('price_normal');
  var kuantarCol = headers.indexOf('price_kuantar');

  if (idCol < 0 || normalCol < 0 || kuantarCol < 0) {
    return jsonResponse({ error: 'Required columns (id, price_normal, price_kuantar) not found in product_variants' });
  }

  // Build id → row-index map (1-based, +1 for header)
  var idToRow = {};
  for (var i = 1; i < data.length; i++) {
    idToRow[data[i][idCol]] = i + 1;
  }

  rows.forEach(function(row) {
    var rowNum = idToRow[row.id];
    if (!rowNum) return;
    sheet.getRange(rowNum, normalCol  + 1).setValue(row.price_normal);
    sheet.getRange(rowNum, kuantarCol + 1).setValue(row.price_kuantar);
  });

  return jsonResponse({ success: true });
}

// ============================================================
//  doPost – Saves orders with server-side invoice counter
// ============================================================
function doPost(e) {
  try {
    const payloadJson = e.parameter.payload;
    if (!payloadJson) {
      return respond(400, { error: "Missing payload" });
    }

    const data = JSON.parse(payloadJson);
    const type = data.type || 'order';

    if (type === 'catalog') {
      return getCatalog(ss);
    }

    if (type === 'update_prices') {
      return updatePrices(ss, data.prices);
    }
    const order = data.order;
    const items = data.items;

    if (!order || !items || !Array.isArray(items)) {
      return respond(400, { error: "Invalid payload" });
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    // --- 1. Get or create the Settings sheet and counter ---
    let settingsSheet = ss.getSheetByName("settings");
    if (!settingsSheet) {
      settingsSheet = ss.insertSheet("settings");
      settingsSheet.getRange("A1").setValue("last_invoice_number");
      settingsSheet.getRange("B1").setValue(0);
    }
    const counterCell = settingsSheet.getRange("B2");
    const currentNum = counterCell.getValue() || 0;
    const newNum = currentNum + 1;
    counterCell.setValue(newNum);
    const orderNumber = "INV-" + String(newNum).padStart(3, "0");

    // --- 2. Prepare the order header with server-generated ID ---
    const orderData = {
      id: orderNumber,
      payment_method: order.payment_method || "",
      price_tier: order.price_tier || "normal",
      total: order.total || 0,
      status: "completed",
      created_by: order.created_by || "Unknown",
      created_at: order.created_at || new Date().toISOString()
    };

    // --- 3. Append to orders sheet ---
    const orderSheet = ss.getSheetByName("orders");
    if (!orderSheet) {
      return respond(500, { error: "Sheet 'orders' not found" });
    }
    orderSheet.appendRow([
      orderData.id,
      orderData.payment_method,
      orderData.price_tier,
      orderData.total,
      orderData.status,
      orderData.created_by,
      orderData.created_at
    ]);

    // --- 4. Append items to order_items sheet ---
    const itemSheet = ss.getSheetByName("order_items");
    if (!itemSheet) {
      return respond(500, { error: "Sheet 'order_items' not found" });
    }
    items.forEach(item => {
  itemSheet.appendRow([
    orderData.id,                // order_id
    item.product_id || 0,
    item.quantity || 1,
    item.unit_price || 0,
    item.line_total || (item.unit_price * item.quantity) || 0,
    item.variant_id || "",       // variant_id
    item.size || "",             // size
    item.filling || "",          // filling
    item.celup || "",            // celup
    item.tabur || "",            // tabur
    item.variant_name || "",     // variant_name
  ]);
});

    return respond(200, {
      success: true,
      orderNumber: orderNumber,
      message: "Order saved"
    });

  } catch (error) {
    console.error(error);
    return respond(500, { error: error.message });
  }
}

// ============================================================
//  doGet – Returns users or transactions based on ?type=
// ============================================================
function doGet(e) {
  try {
    const type = e?.parameter?.type || 'users';
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (type === 'transactions') {
      return getTransactions(ss);
    }

    if (type === 'prices') {
  return getPrices(ss);
}

    // Default: return users
    const usersSheet = ss.getSheetByName("users");
    if (!usersSheet) {
      return respond(404, { error: "Users sheet not found" });
    }
    const data = usersSheet.getDataRange().getValues();
    const headers = data.shift();
    const users = data.map(row => {
      const obj = {};
      headers.forEach((h, i) => obj[h] = row[i]);
      return obj;
    });
    return respond(200, users);

  } catch (error) {
    return respond(500, { error: error.message });
  }
}

// ============================================================
//  getTransactions – Fetches orders + items and builds response
// ============================================================
function getTransactions(ss) {
  const orderSheet = ss.getSheetByName("orders");
  const itemSheet = ss.getSheetByName("order_items");

  if (!orderSheet || !itemSheet) {
    return respond(404, { error: "Orders or order_items sheet not found" });
  }

  // --- Read orders ---
  const orderData = orderSheet.getDataRange().getValues();
  const orderHeaders = orderData.shift();
  const orders = orderData.map(row => {
    const obj = {};
    orderHeaders.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  // --- Read items ---
  const itemData = itemSheet.getDataRange().getValues();
  const itemHeaders = itemData.shift();
  const items = itemData.map(row => {
    const obj = {};
    itemHeaders.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });

  // --- Group items by order_id ---
  const itemsByOrder = {};
  items.forEach(item => {
    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
    itemsByOrder[item.order_id].push(item);
  });

  // --- Build transaction objects ---
   const transactions = orders.map(order => {
    const orderItems = itemsByOrder[order.order_id] || [];
    return {
      id: order.order_id,
      timestamp: order.created_at,
      paymentMethod: order.payment_method,
      priceTier: order.price_tier,
      grandTotal: order.total,
      status: order.status,
      created_by: order.created_by,
      items: orderItems.map(item => ({
        productId: item.product_id,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        lineTotal: item.line_total,
        variantId: item.variant_id,
        size: item.size,
        filling: item.filling,
        celup: item.celup,
        tabur: item.tabur,
        variantName: item.variant_name,
      })),
    };
  });

  return respond(200, transactions);
}

function getPrices(ss) {
  const sheet = ss.getSheetByName("product_variants");
  if (!sheet) {
    return respond(404, { error: "product_variants sheet not found" });
  }
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const rows = data.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
  return respond(200, rows);
}

function updatePrices(ss, prices) {
  try {
    const sheet = ss.getSheetByName("product_variants");
    if (!sheet) {
      return respond(404, { error: "product_variants sheet not found" });
    }

    // Get existing data to find matching rows
    const existingData = sheet.getDataRange().getValues();
    const headers = existingData.shift();
    const idIndex = headers.indexOf('id');
    if (idIndex === -1) {
      return respond(400, { error: "Sheet missing 'id' column" });
    }

    // Build lookup map: id -> row index
    const rowMap = {};
    existingData.forEach((row, idx) => {
      rowMap[row[idIndex]] = idx + 2; // +2 for header row + 0-based
    });

    // Update each row
    prices.forEach((item) => {
      const rowNum = rowMap[item.id];
      if (rowNum) {
        // Find column indices for price_normal and price_kuantar
        const normalIdx = headers.indexOf('price_normal');
        const kuantarIdx = headers.indexOf('price_kuantar');
        if (normalIdx !== -1) {
          sheet.getRange(rowNum, normalIdx + 1).setValue(item.price_normal);
        }
        if (kuantarIdx !== -1) {
          sheet.getRange(rowNum, kuantarIdx + 1).setValue(item.price_kuantar);
        }
      }
    });

    return respond(200, { success: true, message: "Prices updated" });
  } catch (error) {
    return respond(500, { error: error.message });
  }
}

function getCatalog(ss) {
  const sheet = ss.getSheetByName("product_variants");
  if (!sheet) return respond(404, { error: "product_variants not found" });
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const rows = data.map(row => {
    const obj = {};
    headers.forEach((h, i) => obj[h] = row[i]);
    return obj;
  });
  return respond(200, rows);
}

// ============================================================
//  respond – Helper to return JSON
// ============================================================
function respond(code, data) {
  const output = ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
  return output;
}