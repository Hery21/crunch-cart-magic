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
