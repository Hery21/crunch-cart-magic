// HOW TO DEPLOY:
//  1. Open your Google Apps Script project (script.google.com)
//  2. Replace the ENTIRE content of Code.gs with this file
//  3. Deploy > Manage Deployments > Edit (pencil) > "New version" > Deploy
//  4. The /exec URL stays the same – no frontend changes needed

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
    const type = data.type || "order";

    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (type === "update_prices") {
      return updatePrices(ss, data.prices);
    }
    if (type === "add_user") {
      return addUser(ss, data.user);
    }
    if (type === "update_user") {
      return updateUser(ss, data.user);
    }
    if (type === "delete_user") {
      return deleteUser(ss, data.id);
    }
    if (type === "delete_transaction") {
      return deleteTransaction(ss, data.id);
    }
    if (type === "login") {
      return loginUser(ss, data.pin);
    }
    const order = data.order;
    const items = data.items;

    if (!order || !items || !Array.isArray(items)) {
      return respond(400, { error: "Invalid payload" });
    }

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
      created_at:
        order.created_at ||
        Utilities.formatDate(
          new Date(),
          "GMT+7",
          "yyyy-MM-dd'T'HH:mm:ss+07:00",
        ),
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
      orderData.created_at,
    ]);

    // --- 4. Append items to order_items sheet ---
    const itemSheet = ss.getSheetByName("order_items");
    if (!itemSheet) {
      return respond(500, { error: "Sheet 'order_items' not found" });
    }
    items.forEach((item) => {
      itemSheet.appendRow([
        orderData.id, // order_id
        item.product_id || 0,
        item.quantity || 1,
        item.unit_price || 0,
        item.line_total || item.unit_price * item.quantity || 0,
        item.variant_id || "", // variant_id
        item.size || "", // size
        item.filling || "", // filling
        item.celup || "", // celup
        item.tabur || "", // tabur
        item.variant_name || "", // variant_name
      ]);
    });

    return respond(200, {
      success: true,
      orderNumber: orderNumber,
      message: "Order saved",
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
    const type = e?.parameter?.type || "users";
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (type === "catalog") {
      return getCatalog(ss);
    }

    if (type === "transactions") {
      return getTransactions(ss);
    }

    if (type === "prices") {
      return getPrices(ss);
    }

    // Default: return users (password hash is never exposed to clients)
    const usersSheet = ss.getSheetByName("users");
    if (!usersSheet) {
      return respond(404, { error: "Users sheet not found" });
    }
    const data = usersSheet.getDataRange().getValues();
    const headers = data.shift();
    const users = data.map((row) => {
      const obj = {};
      headers.forEach((h, i) => {
        if (h === "password") return;
        obj[h] = row[i];
      });
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
  const orders = orderData.map((row) => {
    const obj = {};
    orderHeaders.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  });

  // --- Read items ---
  const itemData = itemSheet.getDataRange().getValues();
  const itemHeaders = itemData.shift();
  const items = itemData.map((row) => {
    const obj = {};
    itemHeaders.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  });

  // --- Group items by order_id ---
  const itemsByOrder = {};
  items.forEach((item) => {
    if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
    itemsByOrder[item.order_id].push(item);
  });

  // --- Build transaction objects ---
  const transactions = orders.map((order) => {
    const orderItems = itemsByOrder[order.order_id] || [];
    return {
      id: order.order_id,
      timestamp: order.created_at,
      paymentMethod: order.payment_method,
      priceTier: order.price_tier,
      grandTotal: order.total,
      status: order.status,
      created_by: order.created_by,
      isDeleted: String(order.isDeleted).toUpperCase() === "TRUE",
      items: orderItems.map((item) => ({
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
  const rows = data.map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i]));
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
    const idIndex = headers.indexOf("id");
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
        const normalIdx = headers.indexOf("price_normal");
        const kuantarIdx = headers.indexOf("price_kuantar");
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
  const rows = data.map((row) => {
    const obj = {};
    headers.forEach((h, i) => (obj[h] = row[i]));
    return obj;
  });
  return respond(200, rows);
}

// ============================================================
//  PIN hashing – salted SHA-256, stored as "salt$hash"
// ============================================================
function generateSalt() {
  return Utilities.getUuid().replace(/-/g, "");
}

function hashPin(pin, salt) {
  const digest = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    salt + String(pin),
    Utilities.Charset.UTF_8,
  );
  const hex = digest
    .map((b) => (b < 0 ? b + 256 : b).toString(16).padStart(2, "0"))
    .join("");
  return salt + "$" + hex;
}

function verifyPin(pin, stored) {
  if (!stored || stored.indexOf("$") === -1) return false;
  const salt = stored.split("$")[0];
  return hashPin(pin, salt) === stored;
}

// Run this ONCE manually from the Apps Script editor to hash any legacy plaintext PINs.
function migratePlaintextPasswords() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("users");
  if (!sheet) return;
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  const passwordCol = headers.indexOf("password");
  if (passwordCol === -1) return;

  data.forEach((row, i) => {
    const value = String(row[passwordCol]);
    if (value.indexOf("$") === -1) {
      sheet
        .getRange(i + 2, passwordCol + 1)
        .setValue(hashPin(value, generateSalt()));
    }
  });
}

// ============================================================
//  loginUser – verifies PIN server-side, never returns the hash
// ============================================================
function loginUser(ss, pin) {
  try {
    if (!pin) return respond(400, { success: false, error: "Missing PIN" });
    const sheet = ss.getSheetByName("users");
    if (!sheet)
      return respond(404, { success: false, error: "users sheet not found" });

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const idx = {
      id: headers.indexOf("id"),
      username: headers.indexOf("username"),
      password: headers.indexOf("password"),
      display_name: headers.indexOf("display_name"),
      role: headers.indexOf("role"),
    };

    const row = data.find((r) =>
      verifyPin(String(pin), String(r[idx.password])),
    );
    if (!row) return respond(200, { success: false, error: "Invalid PIN" });

    return respond(200, {
      success: true,
      user: {
        id: row[idx.id],
        username: row[idx.username],
        display_name: row[idx.display_name],
        role: row[idx.role],
      },
    });
  } catch (error) {
    return respond(500, { success: false, error: error.message });
  }
}

// ============================================================
//  User management – add / update / delete rows in "users" sheet
// ============================================================
function addUser(ss, user) {
  try {
    if (!user) return respond(400, { error: "Missing user" });
    if (!user.password) return respond(400, { error: "Missing password" });
    const sheet = ss.getSheetByName("users");
    if (!sheet) return respond(404, { error: "users sheet not found" });

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const idIndex = headers.indexOf("id");
    if (idIndex === -1)
      return respond(400, { error: "Sheet missing 'id' column" });

    const maxId = data.reduce(
      (max, row) => Math.max(max, Number(row[idIndex]) || 0),
      0,
    );
    const newId = maxId + 1;

    sheet.appendRow([
      newId,
      user.username || "",
      hashPin(user.password, generateSalt()),
      user.display_name || "",
      user.role || "cashier",
    ]);

    return respond(200, { success: true, id: newId, message: "User added" });
  } catch (error) {
    return respond(500, { error: error.message });
  }
}

function updateUser(ss, user) {
  try {
    if (!user || !user.id) return respond(400, { error: "Missing user id" });
    const sheet = ss.getSheetByName("users");
    if (!sheet) return respond(404, { error: "users sheet not found" });

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const idIndex = headers.indexOf("id");
    if (idIndex === -1)
      return respond(400, { error: "Sheet missing 'id' column" });

    const rowIdx = data.findIndex(
      (row) => String(row[idIndex]) === String(user.id),
    );
    if (rowIdx === -1) return respond(404, { error: "User not found" });
    const rowNum = rowIdx + 2; // +2 for header row + 0-based index

    const fieldIndices = {
      username: headers.indexOf("username"),
      display_name: headers.indexOf("display_name"),
      role: headers.indexOf("role"),
    };
    Object.keys(fieldIndices).forEach((field) => {
      const col = fieldIndices[field];
      if (col !== -1 && user[field] !== undefined) {
        sheet.getRange(rowNum, col + 1).setValue(user[field]);
      }
    });

    // Only rotate the PIN hash when a new PIN was actually supplied
    const passwordCol = headers.indexOf("password");
    if (passwordCol !== -1 && user.password) {
      sheet
        .getRange(rowNum, passwordCol + 1)
        .setValue(hashPin(user.password, generateSalt()));
    }

    return respond(200, { success: true, message: "User updated" });
  } catch (error) {
    return respond(500, { error: error.message });
  }
}

function deleteUser(ss, id) {
  try {
    if (!id) return respond(400, { error: "Missing user id" });
    const sheet = ss.getSheetByName("users");
    if (!sheet) return respond(404, { error: "users sheet not found" });

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const idIndex = headers.indexOf("id");
    if (idIndex === -1)
      return respond(400, { error: "Sheet missing 'id' column" });

    const rowIdx = data.findIndex((row) => String(row[idIndex]) === String(id));
    if (rowIdx === -1) return respond(404, { error: "User not found" });

    sheet.deleteRow(rowIdx + 2); // +2 for header row + 0-based index

    return respond(200, { success: true, message: "User deleted" });
  } catch (error) {
    return respond(500, { error: error.message });
  }
}

// ============================================================
//  deleteTransaction – Soft delete: flags orders.isDeleted = true
// ============================================================
function deleteTransaction(ss, id) {
  try {
    if (!id) return respond(400, { error: "Missing transaction id" });
    const sheet = ss.getSheetByName("orders");
    if (!sheet) return respond(404, { error: "orders sheet not found" });

    const data = sheet.getDataRange().getValues();
    const headers = data.shift();
    const idIndex = headers.indexOf("order_id");
    if (idIndex === -1)
      return respond(400, { error: "Sheet missing 'order_id' column" });

    let isDeletedIndex = headers.indexOf("isDeleted");
    if (isDeletedIndex === -1) {
      // Auto-create the column the first time a transaction is deleted.
      isDeletedIndex = headers.length;
      sheet.getRange(1, isDeletedIndex + 1).setValue("isDeleted");
    }

    const rowIdx = data.findIndex((row) => String(row[idIndex]) === String(id));
    if (rowIdx === -1) return respond(404, { error: "Transaction not found" });

    sheet.getRange(rowIdx + 2, isDeletedIndex + 1).setValue(true);

    return respond(200, { success: true, message: "Transaction deleted" });
  } catch (error) {
    return respond(500, { error: error.message });
  }
}

// ============================================================
//  respond – Helper to return JSON
// ============================================================
function respond(code, data) {
  const output = ContentService.createTextOutput(
    JSON.stringify(data),
  ).setMimeType(ContentService.MimeType.JSON);
  return output;
}
