// ============================================
// FinTrack - Personal Finance Management PWA
// ============================================

// Configuration
const CONFIG = {
  API_BASE: "",
  SHEETS: {
    TRANSACTIONS: "",
    INVESTMENTS: "investments", // Note: lowercase as per your sheet name
    SIP: "SIP",
    FIXED: "FixedExpenses",
    GOALS: "Goals"
  },
  DEFAULT_PIN: "1234",
  MIN_PIN_LENGTH: 4
};

// Chart instances
let cashflowChart = null;
let returnsChart = null;
let networthChart = null;

// Filter state
let dashboardFilter = { type: "all", month: "", year: "" };
let txnFilter = { type: "all", month: "", year: "" };

// ============================================
// AUTHENTICATION
// ============================================

function getStoredPIN() {
  return localStorage.getItem("customPin") || CONFIG.DEFAULT_PIN;
}

function setStoredPIN(pin) {
  localStorage.setItem("customPin", pin);
}

function getApiBase() {
  return localStorage.getItem("apiBase") || "";
}

function setApiBase(apiBase) {
  localStorage.setItem("apiBase", apiBase);
}

function isAuthenticated() {
  return localStorage.getItem("auth") === "true";
}

function setAuth(authenticated) {
  if (authenticated) {
    localStorage.setItem("auth", "true");
  } else {
    localStorage.removeItem("auth");
  }
}

function login() {
  console.log("[FinTrack] Login clicked");

  const input = document.getElementById("pinInput");
  if (!input) {
    console.error("[FinTrack] pinInput not found");
    return;
  }

  const pin = getStoredPIN();
  if (input.value !== pin) {
    alert("❌ Wrong PIN. Please try again.");
    input.value = "";
    input.focus();
    return;
  }

  // Auth success
  setAuth(true);
  document.getElementById("loginBox").style.display = "none";
  document.getElementById("app").style.display = "block";

  showTab("dashboardTab");

  // AFTER login → check API base
  if (!getApiBase()) {
    showApiBasePopup();
    return;
  }

  initializeApp();
}

function logout() {
  if (confirm("Are you sure you want to logout?")) {
    setAuth(false);
    document.getElementById("app").style.display = "none";
    document.getElementById("loginBox").style.display = "block";
    document.getElementById("pinInput").value = "";
  }
}

function togglePinChange() {
  const box = document.getElementById("pinChangeBox");
  if (box) {
    box.style.display = box.style.display === "none" ? "block" : "none";
    if (box.style.display === "block") {
      document.getElementById("oldPin").value = "";
      document.getElementById("newPin").value = "";
    }
  }
}

function changePin() {
  const oldPinInput = document.getElementById("oldPin");
  const newPinInput = document.getElementById("newPin");
  
  if (!oldPinInput || !newPinInput) return;

  const currentPIN = getStoredPIN();
  const oldPin = oldPinInput.value;
  const newPin = newPinInput.value;

  if (oldPin !== currentPIN) {
    alert("❌ Invalid old PIN.");
    return;
  }

  if (newPin.length < CONFIG.MIN_PIN_LENGTH) {
    alert(`❌ New PIN must be at least ${CONFIG.MIN_PIN_LENGTH} digits.`);
    return;
  }

  setStoredPIN(newPin);
  alert("✅ PIN updated successfully!");
  togglePinChange();
}

// ============================================
// TAB NAVIGATION
// ============================================

function showTab(tabId) {
  // Hide all tabs
  document.querySelectorAll(".tab").forEach(tab => {
    tab.style.display = "none";
  });

  // Remove active class from all buttons
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.classList.remove("active");
  });

  // Show selected tab
  const selectedTab = document.getElementById(tabId);
  if (selectedTab) {
    selectedTab.style.display = "block";
  }

  // Add active class to selected button
  const selectedBtn = document.querySelector(`[data-tab="${tabId}"]`);
  if (selectedBtn) {
    selectedBtn.classList.add("active");
  }

  // Load data for the tab
  if (tabId === "dashboardTab") {
    loadDashboard();
  } else if (tabId === "transactionsTab") {
      loadTransactions();
  } else if (tabId === "investmentsTab") {
    loadInvestments();
  } else if (tabId === "sipTab") {
    loadSIPs();
  } else if (tabId === "fixedTab") {
    loadFixedExpenses();
  } else if (tabId === "goalsTab") {
    loadGoals();
  }
}

// ============================================
// API HELPERS
// ============================================

async function fetchSheet(sheetName = "") {
  const url = sheetName 
    ? `${getApiBase()}?sheet=${sheetName}`
    : getApiBase();
  
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    
    // Debug: Log available fields (only first time, to help with debugging)
    if (data.length > 0 && !window._idFieldsLogged) {
      const firstRow = data[0];
      const allFields = Object.keys(firstRow);
      const idFields = allFields.filter(key => 
        key.toLowerCase().includes('id') || 
        key.toLowerCase() === 'id' || 
        key.toLowerCase() === 'row_id' ||
        key.toLowerCase() === '_id'
      );
      
      console.log(`[FinTrack] Sheet: ${sheetName || "main sheet"}`);
      console.log(`[FinTrack] All available fields:`, allFields);
      if (idFields.length > 0) {
        console.log(`[FinTrack] ID fields found:`, idFields);
        console.log(`[FinTrack] Sample row ID values:`, idFields.map(f => ({ field: f, value: firstRow[f] })));
      } else {
        console.warn(`[FinTrack] ⚠️ No ID fields found! SheetDB should auto-generate an 'id' field.`);
        console.log(`[FinTrack] First row sample:`, firstRow);
      }
      window._idFieldsLogged = true;
    }
    
    return data;
  } catch (error) {
    console.error(`Error fetching ${sheetName || "Transactions"}:`, error);
    return [];
  }
}

async function postToSheet(sheetName, data) {
  const url = sheetName 
    ? `${getApiBase()}?sheet=${sheetName}`
    : getApiBase();
  
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data })
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error(`Error posting to ${sheetName || "Transactions"}:`, error);
    throw error;
  }
}

async function deleteFromSheet(rowId, sheetName = "", rowData = null) {
  // ✅ Preferred: use SheetDB auto-generated `id`
  if (rowId) {
    const url = sheetName
      ? `${getApiBase()}/id/${rowId}?sheet=${sheetName}`
      : `${getApiBase()}/id/${rowId}`;

    const response = await fetch(url, { method: "DELETE" });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text);
    }
    return true;
  }

  // ✅ Fallback: column + value delete (SheetDB supported)
  if (!rowData) {
    throw new Error("No rowId or rowData provided for deletion");
  }

  // Choose a UNIQUE column for deletion
  const column =
    rowData.Description
      ? "Description"
      : rowData.Name
      ? "Name"
      : rowData.Asset
      ? "Asset"
      : rowData.Goal
      ? "Goal"
      : null;

  const value =
    rowData.Description ||
    rowData.Name ||
    rowData.Asset ||
    rowData.Goal;

  if (!column || !value) {
    throw new Error("No unique column/value found for deletion");
  }

  const deleteUrl = sheetName
    ? `${getApiBase()}/${column}/${encodeURIComponent(value)}?sheet=${sheetName}`
    : `${getApiBase()}/${column}/${encodeURIComponent(value)}`;

  const response = await fetch(deleteUrl, { method: "DELETE" });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text);
  }

  return true;
}

// Delete by matching field values (fallback when no ID column exists)
async function deleteByFieldMatching(rowData, sheetName = "") {
  // Build a search query using unique fields
  // For transactions: Date + Type + Amount + Description
  // For investments: Date + Asset + InvestedAmount
  // etc.
  
  const searchParams = new URLSearchParams();
  
  if (rowData.Date) searchParams.append("Date", rowData.Date);
  if (rowData.Type) searchParams.append("Type", rowData.Type);
  if (rowData.Amount !== undefined && rowData.Amount !== null) {
    searchParams.append("Amount", String(rowData.Amount));
  }
  if (rowData.Description) searchParams.append("Description", rowData.Description);
  if (rowData.Category) searchParams.append("Category", rowData.Category);
  if (rowData.Asset) searchParams.append("Asset", rowData.Asset);
  if (rowData.InvestedAmount !== undefined && rowData.InvestedAmount !== null) {
    searchParams.append("InvestedAmount", String(rowData.InvestedAmount));
  }
  if (rowData.Name) searchParams.append("Name", rowData.Name);
  if (rowData.Goal) searchParams.append("Goal", rowData.Goal);
  // SIP fields
  if (rowData.StartDate) searchParams.append("StartDate", rowData.StartDate);
  if (rowData.MonthlyAmount !== undefined && rowData.MonthlyAmount !== null) {
    searchParams.append("MonthlyAmount", String(rowData.MonthlyAmount));
  }
  if (rowData.Day !== undefined && rowData.Day !== null) {
    searchParams.append("Day", String(rowData.Day));
  }
  // FixedExpenses fields
  if (rowData.Category) searchParams.append("Category", rowData.Category);
  if (rowData.Frequency) searchParams.append("Frequency", rowData.Frequency);
  if (rowData.DueDay !== undefined && rowData.DueDay !== null) {
    searchParams.append("DueDay", String(rowData.DueDay));
  }
  
  const queryString = searchParams.toString();
  if (!queryString) {
    throw new Error("Cannot delete: No unique fields found to match");
  }
  
  // SheetDB search uses query parameters directly
  const baseUrl = sheetName 
    ? `${getApiBase()}?sheet=${sheetName}`
    : getApiBase();
  
  // First, search for the row - append query params correctly
  const separator = baseUrl.includes("?") ? "&" : "?";
  const searchUrl = `${baseUrl}${separator}${queryString}`;
  
  console.log(`[FinTrack] Searching for row to delete: ${searchUrl}`);
  
  const searchResponse = await fetch(searchUrl);
  
  if (!searchResponse.ok) {
    const errorText = await searchResponse.text();
    throw new Error(`Search failed: HTTP ${searchResponse.status}: ${errorText}`);
  }
  
  const matchingRows = await searchResponse.json();
  
  if (matchingRows.length === 0) {
    throw new Error("No matching row found to delete");
  }
  
  if (matchingRows.length > 1) {
    console.warn(`[FinTrack] Multiple rows match. Deleting first match. Found ${matchingRows.length} rows.`);
  }
  
  // Get the ID from the found row (SheetDB should have auto-generated it)
  const rowToDelete = matchingRows[0];
  const deleteId = rowToDelete.id || rowToDelete.ID || rowToDelete._id || rowToDelete.row_id;
  
  // Try to delete using search parameters (SheetDB might support this)
  // This is more reliable than trying to use ID when row_id column doesn't exist
  console.log("[FinTrack] Attempting delete using search parameters...");
  
  const deleteUrl = sheetName 
    ? `${getApiBase()}?sheet=${sheetName}`
    : getApiBase();
  
  // Try DELETE with search params
  const deleteWithParams = `${deleteUrl}&${queryString}`;
  let deleteResponse = await fetch(deleteWithParams, { method: "DELETE" });
  
  if (deleteResponse.ok) {
    console.log("[FinTrack] Successfully deleted row using search parameters");
    return true;
  }
  
  // If that didn't work, try using the found ID (if available)
  if (deleteId) {
    console.log(`[FinTrack] Trying to delete using found ID: ${deleteId}`);
    const idDeleteUrl = sheetName 
      ? `${getApiBase()}/id/${deleteId}?sheet=${sheetName}`
      : `${getApiBase()}/id/${deleteId}`;
    
    deleteResponse = await fetch(idDeleteUrl, { method: "DELETE" });
    
    if (deleteResponse.ok) {
      console.log("[FinTrack] Successfully deleted row using ID");
      return true;
    }
    
    const errorText = await deleteResponse.text();
    // If it fails with row_id error, try alternative method
    if (errorText.includes("row_id") || errorText.includes("Undefined column")) {
      console.log("[FinTrack] ID deletion failed due to missing row_id column, trying alternative method...");
      // Try POST to delete endpoint with row data
      return await deleteByPostingRowData(rowData, sheetName, matchingRows[0]);
    }
  }
  
  // Last resort: try POST method to delete
  return await deleteByPostingRowData(rowData, sheetName, matchingRows[0]);
}

// Alternative deletion method: POST the row to delete endpoint
async function deleteByPostingRowData(rowData, sheetName, fullRowData) {
  console.log("[FinTrack] Attempting alternative deletion method...");
  
  // SheetDB might support deleting by posting the exact row with a DELETE flag
  // Or we might need to use a different approach
  
  // Build complete row data from the found row
  const deletePayload = { ...fullRowData };
  
  // Try DELETE with complete row data in body
  const deleteUrl = sheetName 
    ? `${getApiBase()}?sheet=${sheetName}`
    : getApiBase();
  
  try {
    // Some SheetDB setups support DELETE with row data
    const response = await fetch(deleteUrl, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: deletePayload })
    });
    
    if (response.ok) {
      console.log("[FinTrack] Successfully deleted using row data method");
      return true;
    }
    
    const errorText = await response.text();
    throw new Error(`Alternative delete method failed: HTTP ${response.status}: ${errorText}`);
  } catch (error) {
    throw new Error(`Cannot delete row. SheetDB requires an 'id' column for deletion. Please add an 'id' column to your Google Sheet as the first column, or contact SheetDB support. Error: ${error.message}`);
  }
}

async function updateSheet(rowId, data, sheetName = "") {
  if (!rowId) {
    throw new Error("Row ID is required for update");
  }
  
  // SheetDB supports both /id/ and /row_id/ endpoints
  // Try /id/ first as it's more common
  let url = sheetName 
    ? `${getApiBase()}/id/${rowId}?sheet=${sheetName}`
    : `${getApiBase()}/id/${rowId}`;
  
  try {
    let response = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data })
    });
    
    // If 404, try with row_id endpoint
    if (response.status === 404) {
      url = sheetName 
        ? `${getApiBase()}/row_id/${rowId}?sheet=${sheetName}`
        : `${getApiBase()}/row_id/${rowId}`;
      response = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data })
      });
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`Error updating row ${rowId} in ${sheetName || "main sheet"}:`, error);
    throw error;
  }
}

// ============================================
// TRANSACTIONS
// ============================================

async function loadTransactions() {
  const allTransactions = await fetchSheet(CONFIG.SHEETS.TRANSACTIONS);
  
  // Populate filter dropdowns
  populateMonthDropdown("txnFilterMonth", allTransactions);
  populateYearDropdown("txnFilterYear", allTransactions);
  
  // Apply filter
  const transactions = filterTransactions(allTransactions, txnFilter);
  
  // Update filter info
  const filterInfo = document.getElementById("txnFilterInfo");
  if (filterInfo) {
    filterInfo.textContent = getFilterInfo(txnFilter);
    filterInfo.className = txnFilter.type === "all" ? "filter-info" : "filter-info active";
  }
  
  const tbody = document.getElementById("txnTableBody");
  if (!tbody) return;

  if (transactions.length === 0) {
    tbody.innerHTML = "<tr><td colspan='7' class='empty-state'>No transactions found. " + 
      (txnFilter.type !== "all" ? "Try adjusting your filter." : "Add your first transaction above.") + 
      "</td></tr>";
    return;
  }

  tbody.innerHTML = transactions.map((t, index) => {
    const typeClass = t.Type === "Credit" ? "credit" : "debit";
    // Try multiple possible ID field names that SheetDB might use
    const rowId = t.id || t.row_id || t._id || t.ID || "";
    // Store row data in data attribute for fallback deletion
    const rowData = {
      Date: t.Date,
      Type: t.Type,
      Amount: t.Amount,
      Description: t.Description || "",
      Category: t.Category || ""
    };
    const rowDataAttr = JSON.stringify(rowData).replace(/"/g, '&quot;');
    return `
      <tr>
        <td>${formatDate(t.Date)}</td>
        <td><span class="badge ${typeClass}">${t.Type}</span></td>
        <td>${t.Category || "-"}</td>
        <td>${t.Description || "-"}</td>
        <td class="amount ${typeClass}">₹${formatNumber(t.Amount || 0)}</td>
        <td><span class="badge source">${t.Source || "Manual"}</span></td>
        <td>
          <button class="btn-icon delete-txn-btn" 
                  data-row-id="${rowId || ''}" 
                  data-row-data="${rowDataAttr}"
                  title="Delete">🗑️</button>
        </td>
      </tr>
    `;
  }).join("");
  
  // Attach event listeners to delete buttons
  document.querySelectorAll(".delete-txn-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      const rowId = this.getAttribute("data-row-id");
      const rowDataStr = this.getAttribute("data-row-data");
      let rowData = null;
      
      if (rowDataStr) {
        try {
          rowData = JSON.parse(rowDataStr.replace(/&quot;/g, '"'));
        } catch (e) {
          console.error("[FinTrack] Failed to parse row data:", e);
        }
      }
      
      console.log("[FinTrack] Delete clicked - ID:", rowId, "RowData:", rowData);
      deleteTransaction(rowId || null, rowData);
    });
  });
}

async function addTransaction(e) {
  e.preventDefault();

  const payload = {
    Date: document.getElementById("txnDate").value || new Date().toISOString().split("T")[0],
    Type: document.getElementById("txnType").value,
    Category: document.getElementById("txnCategory").value,
    Description: document.getElementById("txnDesc").value || "",
    Amount: parseFloat(document.getElementById("txnAmount").value),
    Source: "Manual"
  };

  try {
    await postToSheet(CONFIG.SHEETS.TRANSACTIONS, payload);
  e.target.reset();
    document.getElementById("txnDate").value = new Date().toISOString().split("T")[0];
    await loadTransactions();
    await loadDashboard();
    showNotification("✅ Transaction added successfully!");
  } catch (error) {
    showNotification("❌ Failed to add transaction. Please try again.", "error");
  }
}

async function deleteTransaction(id, rowData = null) {
  if (!confirm("Are you sure you want to delete this transaction?")) return;
  
  // If no ID or invalid ID, we'll use rowData for deletion
  const validId = (id && id !== "null" && id !== "undefined" && id !== "") ? id : null;
  
  if (!validId && !rowData) {
    showNotification("❌ Cannot delete: Missing row information. Please refresh the page.", "error");
    return;
  }
  
  try {
    await deleteFromSheet(validId, CONFIG.SHEETS.TRANSACTIONS, rowData);
    await loadTransactions();
    await loadDashboard();
    showNotification("✅ Transaction deleted successfully!");
  } catch (error) {
    console.error("Delete error:", error);
    showNotification(`❌ Failed to delete transaction: ${error.message}`, "error");
  }
}

// ============================================
// INVESTMENTS
// ============================================

async function loadInvestments() {
  const investments = await fetchSheet(CONFIG.SHEETS.INVESTMENTS);
  const tbody = document.getElementById("investmentTableBody");
  if (!tbody) return;

  if (investments.length === 0) {
    tbody.innerHTML = "<tr><td colspan='8' class='empty-state'>No investments yet. Add your first investment above.</td></tr>";
    return;
  }

  tbody.innerHTML = investments.map((inv, index) => {
    const invested = parseFloat(inv.InvestedAmount || 0);
    const current = parseFloat(inv.CurrentValue || 0);
    const gainLoss = current - invested;
    const gainLossPercent = invested > 0 ? ((gainLoss / invested) * 100).toFixed(2) : 0;
    const gainLossClass = gainLoss >= 0 ? "credit" : "debit";
    
    // Calculate CAGR
    const date = new Date(inv.Date);
    const now = new Date();
    const years = (now - date) / (365.25 * 24 * 60 * 60 * 1000);
    const cagr = calculateCAGR(invested, current, years);
    
    const rowId = inv.id || inv.row_id || inv._id || inv.ID || "";
    // Store row data for fallback deletion
    const rowData = {
      Date: inv.Date,
      Asset: inv.Asset || "",
      InvestedAmount: inv.InvestedAmount
    };
    const rowDataAttr = JSON.stringify(rowData).replace(/"/g, '&quot;');

    return `
      <tr>
        <td>${formatDate(inv.Date)}</td>
        <td><strong>${inv.Asset || "-"}</strong></td>
        <td>₹${formatNumber(invested)}</td>
        <td>₹${formatNumber(current)}</td>
        <td class="amount ${gainLossClass}">₹${formatNumber(gainLoss)} (${gainLossPercent}%)</td>
        <td class="${gainLossClass}">${cagr.toFixed(2)}%</td>
        <td>${inv.Notes || "-"}</td>
        <td>
          <button class="btn-icon delete-inv-btn" 
                  data-row-id="${rowId || ''}" 
                  data-row-data="${rowDataAttr}"
                  title="Delete">🗑️</button>
        </td>
      </tr>
    `;
  }).join("");
  
  // Attach event listeners to investment delete buttons
  document.querySelectorAll(".delete-inv-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      const rowId = this.getAttribute("data-row-id");
      const rowDataStr = this.getAttribute("data-row-data");
      let rowData = null;
      
      if (rowDataStr) {
        try {
          rowData = JSON.parse(rowDataStr.replace(/&quot;/g, '"'));
        } catch (e) {
          console.error("[FinTrack] Failed to parse investment row data:", e);
        }
      }
      
      console.log("[FinTrack] Delete investment clicked - ID:", rowId, "RowData:", rowData);
      deleteInvestment(rowId || null, rowData);
    });
  });
}

async function addInvestment(e) {
  e.preventDefault();

  const payload = {
    Date: document.getElementById("invDate").value || new Date().toISOString().split("T")[0],
    Asset: document.getElementById("invAsset").value,
    InvestedAmount: parseFloat(document.getElementById("invInvested").value),
    CurrentValue: parseFloat(document.getElementById("invCurrent").value),
    Notes: document.getElementById("invNotes").value || ""
  };

  try {
    await postToSheet(CONFIG.SHEETS.INVESTMENTS, payload);
    e.target.reset();
    document.getElementById("invDate").value = new Date().toISOString().split("T")[0];
    await loadInvestments();
    await loadDashboard();
    showNotification("✅ Investment added successfully!");
  } catch (error) {
    showNotification("❌ Failed to add investment. Please try again.", "error");
  }
}

async function deleteInvestment(id, rowData = null) {
  if (!confirm("Are you sure you want to delete this investment?")) return;
  
  // If no ID or invalid ID, we'll use rowData for deletion
  const validId = (id && id !== "null" && id !== "undefined" && id !== "") ? id : null;
  
  if (!validId && !rowData) {
    showNotification("❌ Cannot delete: Missing row information. Please refresh the page.", "error");
    return;
  }
  
  try {
    await deleteFromSheet(validId, CONFIG.SHEETS.INVESTMENTS, rowData);
    await loadInvestments();
    await loadDashboard();
    showNotification("✅ Investment deleted successfully!");
  } catch (error) {
    console.error("Delete error:", error);
    showNotification(`❌ Failed to delete investment: ${error.message}`, "error");
  }
}

// ============================================
// SIP
// ============================================

async function loadSIPs() {
  const sips = await fetchSheet(CONFIG.SHEETS.SIP);
  const tbody = document.getElementById("sipTableBody");
  if (!tbody) return;

  if (sips.length === 0) {
    tbody.innerHTML = "<tr><td colspan='8' class='empty-state'>No SIP plans yet. Add your first SIP above.</td></tr>";
    return;
  }

  tbody.innerHTML = sips.map((sip, index) => {
    const active = sip.Active === "TRUE" || sip.Active === true || sip.Active === "true";
    const statusClass = active ? "active" : "inactive";
    const duration = sip.DurationMonths && parseInt(sip.DurationMonths) > 0 
      ? `${sip.DurationMonths} months` 
      : "Indefinite";
    const rowId = sip.id || sip.row_id || sip._id || sip.ID || "";
    const rowIdStr = rowId ? `'${rowId}'` : "null";
    // Store row data for fallback deletion
    const rowData = {
      StartDate: sip.StartDate,
      Asset: sip.Asset || "",
      MonthlyAmount: sip.MonthlyAmount,
      Day: sip.Day
    };
    const rowDataAttr = JSON.stringify(rowData).replace(/"/g, '&quot;');
    
    return `
      <tr>
        <td>${formatDate(sip.StartDate)}</td>
        <td><strong>${sip.Asset || "-"}</strong></td>
        <td>₹${formatNumber(sip.MonthlyAmount || 0)}</td>
        <td>${sip.Day || "-"}</td>
        <td>${duration}</td>
        <td><span class="badge ${statusClass}">${active ? "Active" : "Inactive"}</span></td>
        <td>${sip.LastPostedMonth || "Never"}</td>
        <td>
          <button class="btn-icon toggle-sip-btn" 
                  data-row-id="${rowId || ''}" 
                  data-active="${!active}"
                  title="${active ? "Deactivate" : "Activate"}">
            ${active ? "⏸️" : "▶️"}
          </button>
          <button class="btn-icon delete-sip-btn" 
                  data-row-id="${rowId || ''}" 
                  data-row-data="${rowDataAttr}"
                  title="Delete">🗑️</button>
        </td>
      </tr>
    `;
  }).join("");
  
  // Attach event listeners to SIP buttons
  document.querySelectorAll(".delete-sip-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      const rowId = this.getAttribute("data-row-id");
      const rowDataStr = this.getAttribute("data-row-data");
      let rowData = null;
      
      if (rowDataStr) {
        try {
          rowData = JSON.parse(rowDataStr.replace(/&quot;/g, '"'));
        } catch (e) {
          console.error("[FinTrack] Failed to parse SIP row data:", e);
        }
      }
      
      console.log("[FinTrack] Delete SIP clicked - ID:", rowId, "RowData:", rowData);
      deleteSIP(rowId || null, rowData);
    });
  });
  
  document.querySelectorAll(".toggle-sip-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      const rowId = this.getAttribute("data-row-id");
      const active = this.getAttribute("data-active") === "true";
      toggleSIP(rowId || null, active);
    });
  });
}

async function addSIP(e) {
  e.preventDefault();

  const payload = {
    StartDate: document.getElementById("sipStartDate").value || new Date().toISOString().split("T")[0],
    Asset: document.getElementById("sipAsset").value,
    MonthlyAmount: parseFloat(document.getElementById("sipAmount").value),
    Day: parseInt(document.getElementById("sipDay").value),
    DurationMonths: document.getElementById("sipDurationMonths").value || "0",
    Active: document.getElementById("sipActive").checked ? "TRUE" : "FALSE",
    LastPostedMonth: ""
  };

  try {
    await postToSheet(CONFIG.SHEETS.SIP, payload);
  e.target.reset();
    document.getElementById("sipActive").checked = true;
    await loadSIPs();
    await loadDashboard();
    showNotification("✅ SIP added successfully!");
  } catch (error) {
    showNotification("❌ Failed to add SIP. Please try again.", "error");
  }
}

async function toggleSIP(id, active) {
  if (!id || id === "null" || id === "undefined") {
    showNotification("❌ Cannot update: Row ID not found. Please refresh the page.", "error");
    return;
  }
  
  try {
    await updateSheet(id, { Active: active ? "TRUE" : "FALSE" }, CONFIG.SHEETS.SIP);
    await loadSIPs();
    await loadDashboard();
    showNotification(`✅ SIP ${active ? "activated" : "deactivated"} successfully!`);
  } catch (error) {
    console.error("Update error:", error);
    showNotification("❌ Failed to update SIP. Please try again.", "error");
  }
}

async function deleteSIP(id, rowData = null) {
  if (!confirm("Are you sure you want to delete this SIP plan?")) return;
  
  // If no ID or invalid ID, we'll use rowData for deletion
  const validId = (id && id !== "null" && id !== "undefined" && id !== "") ? id : null;
  
  if (!validId && !rowData) {
    showNotification("❌ Cannot delete: Missing row information. Please refresh the page.", "error");
    return;
  }
  
  try {
    await deleteFromSheet(validId, CONFIG.SHEETS.SIP, rowData);
    await loadSIPs();
    await loadDashboard();
    showNotification("✅ SIP deleted successfully!");
  } catch (error) {
    console.error("Delete error:", error);
    showNotification(`❌ Failed to delete SIP: ${error.message}`, "error");
  }
}

// ============================================
// FIXED EXPENSES
// ============================================

async function loadFixedExpenses() {
  const fixed = await fetchSheet(CONFIG.SHEETS.FIXED);
  const tbody = document.getElementById("fixedTableBody");
  if (!tbody) return;

  if (fixed.length === 0) {
    tbody.innerHTML = "<tr><td colspan='9' class='empty-state'>No fixed expenses yet. Add your first fixed expense above.</td></tr>";
    return;
  }

  tbody.innerHTML = fixed.map((exp, index) => {
    const active = exp.Active === "TRUE" || exp.Active === true || exp.Active === "true";
    const statusClass = active ? "active" : "inactive";
    const autoDebit = exp.AutoDebit === "TRUE" || exp.AutoDebit === true || exp.AutoDebit === "true";
    const rowId = exp.id || exp.row_id || exp._id || exp.ID || "";
    const rowIdStr = rowId ? `'${rowId}'` : "null";
    // Store row data for fallback deletion
    const rowData = {
      Name: exp.Name || "",
      Category: exp.Category || "",
      Amount: exp.Amount,
      Frequency: exp.Frequency || "",
      DueDay: exp.DueDay
    };
    const rowDataAttr = JSON.stringify(rowData).replace(/"/g, '&quot;');
    
    return `
      <tr>
        <td><strong>${exp.Name || "-"}</strong></td>
        <td>${exp.Category || "-"}</td>
        <td>₹${formatNumber(exp.Amount || 0)}</td>
        <td>${exp.Frequency || "-"}</td>
        <td>${exp.DueDay || "-"}</td>
        <td><span class="badge ${autoDebit ? "active" : "inactive"}">${autoDebit ? "Yes" : "No"}</span></td>
        <td><span class="badge ${statusClass}">${active ? "Active" : "Inactive"}</span></td>
        <td>${exp.LastPostedMonth || "Never"}</td>
        <td>
          <button class="btn-icon toggle-fixed-btn" 
                  data-row-id="${rowId || ''}" 
                  data-active="${!active}"
                  title="${active ? "Deactivate" : "Activate"}">
            ${active ? "⏸️" : "▶️"}
          </button>
          <button class="btn-icon delete-fixed-btn" 
                  data-row-id="${rowId || ''}" 
                  data-row-data="${rowDataAttr}"
                  title="Delete">🗑️</button>
        </td>
      </tr>
    `;
  }).join("");
  
  // Attach event listeners to fixed expense buttons
  document.querySelectorAll(".delete-fixed-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      const rowId = this.getAttribute("data-row-id");
      const rowDataStr = this.getAttribute("data-row-data");
      let rowData = null;
      
      if (rowDataStr) {
        try {
          rowData = JSON.parse(rowDataStr.replace(/&quot;/g, '"'));
        } catch (e) {
          console.error("[FinTrack] Failed to parse fixed expense row data:", e);
        }
      }
      
      console.log("[FinTrack] Delete fixed expense clicked - ID:", rowId, "RowData:", rowData);
      deleteFixedExpense(rowId || null, rowData);
    });
  });
  
  document.querySelectorAll(".toggle-fixed-btn").forEach(btn => {
    btn.addEventListener("click", function() {
      const rowId = this.getAttribute("data-row-id");
      const active = this.getAttribute("data-active") === "true";
      toggleFixedExpense(rowId || null, active);
    });
  });
}

async function addFixedExpense(e) {
  e.preventDefault();

  const payload = {
    Name: document.getElementById("fixedName").value,
    Category: document.getElementById("fixedCategory").value || "",
    Amount: parseFloat(document.getElementById("fixedAmount").value),
    Frequency: document.getElementById("fixedFrequency").value || "Monthly",
    DueDay: parseInt(document.getElementById("fixedDueDay").value),
    AutoDebit: document.getElementById("fixedAutoDebit").checked ? "TRUE" : "FALSE",
    Active: document.getElementById("fixedActive").checked ? "TRUE" : "FALSE",
    LastPostedMonth: ""
  };

  try {
    await postToSheet(CONFIG.SHEETS.FIXED, payload);
    e.target.reset();
    document.getElementById("fixedActive").checked = true;
    await loadFixedExpenses();
    await loadDashboard();
    showNotification("✅ Fixed expense added successfully!");
  } catch (error) {
    showNotification("❌ Failed to add fixed expense. Please try again.", "error");
  }
}

async function toggleFixedExpense(id, active) {
  if (!id || id === "null" || id === "undefined") {
    showNotification("❌ Cannot update: Row ID not found. Please refresh the page.", "error");
    return;
  }
  
  try {
    await updateSheet(id, { Active: active ? "TRUE" : "FALSE" }, CONFIG.SHEETS.FIXED);
    await loadFixedExpenses();
    await loadDashboard();
    showNotification(`✅ Fixed expense ${active ? "activated" : "deactivated"} successfully!`);
  } catch (error) {
    console.error("Update error:", error);
    showNotification("❌ Failed to update fixed expense. Please try again.", "error");
  }
}

async function deleteFixedExpense(id, rowData = null) {
  if (!confirm("Are you sure you want to delete this fixed expense?")) return;
  
  // If no ID or invalid ID, we'll use rowData for deletion
  const validId = (id && id !== "null" && id !== "undefined" && id !== "") ? id : null;
  
  if (!validId && !rowData) {
    showNotification("❌ Cannot delete: Missing row information. Please refresh the page.", "error");
    return;
  }
  
  try {
    await deleteFromSheet(validId, CONFIG.SHEETS.FIXED, rowData);
    await loadFixedExpenses();
    await loadDashboard();
    showNotification("✅ Fixed expense deleted successfully!");
  } catch (error) {
    console.error("Delete error:", error);
    showNotification(`❌ Failed to delete fixed expense: ${error.message}`, "error");
  }
}

// ============================================
// GOALS
// ============================================

async function loadGoals() {
  const goals = await fetchSheet(CONFIG.SHEETS.GOALS);
  const container = document.getElementById("goals");
  if (!container) return;

  if (goals.length === 0) {
    container.innerHTML = "<div class='empty-state'>No goals yet. Add your first goal above.</div>";
    return;
  }

  container.innerHTML = goals.map(goal => {
    const current = parseFloat(goal.CurrentAmount || 0);
    const target = parseFloat(goal.TargetAmount || 0);
    const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
    const remaining = Math.max(0, target - current);
    
    const deadline = goal.Deadline ? new Date(goal.Deadline) : null;
    const now = new Date();
    const daysRemaining = deadline ? Math.ceil((deadline - now) / (1000 * 60 * 60 * 24)) : null;
    
    // Use Status from sheet if available, otherwise calculate
    let status = goal.Status || "On Track";
    let statusClass = "success";
    
    if (!goal.Status) {
      // Calculate status if not provided
      if (progress >= 100) {
        status = "Achieved";
        statusClass = "achieved";
      } else if (deadline && daysRemaining !== null) {
        const monthlyNeeded = daysRemaining > 0 ? remaining / (daysRemaining / 30) : 0;
        if (monthlyNeeded > (target * 0.1)) {
          status = "At Risk";
          statusClass = "warning";
        }
      }
    } else {
      // Map Status values to classes
      if (goal.Status === "Achieved" || goal.Status === "Completed") {
        statusClass = "achieved";
      } else if (goal.Status === "At Risk" || goal.Status === "Delayed") {
        statusClass = "warning";
      } else if (goal.Status === "Cancelled" || goal.Status === "On Hold") {
        statusClass = "inactive";
      }
    }

    return `
      <div class="goal-card">
        <div class="goal-header">
          <h4>${goal.Goal || "Unnamed Goal"}</h4>
          ${goal.Priority ? `<span class="badge">Priority: ${goal.Priority}</span>` : ""}
          <span class="badge ${statusClass}">${status}</span>
        </div>
        <div class="goal-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${progress}%"></div>
          </div>
          <div class="progress-text">
            ₹${formatNumber(current)} / ₹${formatNumber(target)} (${progress.toFixed(1)}%)
          </div>
        </div>
        <div class="goal-details">
          <div>Remaining: ₹${formatNumber(remaining)}</div>
          ${deadline ? `<div>Deadline: ${formatDate(goal.Deadline)} ${daysRemaining !== null ? `(${daysRemaining > 0 ? daysRemaining + " days" : "Overdue"})` : ""}</div>` : ""}
        </div>
        <div class="goal-actions">
          <button class="btn-icon" onclick="deleteGoal('${goal.id || goal.row_id || goal._id || goal.ID || ""}')" title="Delete" ${!(goal.id || goal.row_id || goal._id || goal.ID) ? 'disabled' : ''}>🗑️</button>
        </div>
      </div>
    `;
  }).join("");
}

async function addGoal(e) {
  e.preventDefault();

  const payload = {
    Goal: document.getElementById("goalName").value,
    TargetAmount: parseFloat(document.getElementById("goalTarget").value),
    CurrentAmount: parseFloat(document.getElementById("goalCurrent").value),
    Deadline: document.getElementById("goalDeadline").value || ""
  };

  try {
    await postToSheet(CONFIG.SHEETS.GOALS, payload);
    e.target.reset();
    await loadGoals();
    await loadDashboard();
    showNotification("✅ Goal added successfully!");
  } catch (error) {
    showNotification("❌ Failed to add goal. Please try again.", "error");
  }
}

async function deleteGoal(id) {
  if (!id || id === "") {
    showNotification("❌ Cannot delete: Row ID not found. Please refresh the page.", "error");
    return;
  }
  
  if (!confirm("Are you sure you want to delete this goal?")) return;
  
  try {
    await deleteFromSheet(id, CONFIG.SHEETS.GOALS);
    await loadGoals();
    showNotification("✅ Goal deleted successfully!");
  } catch (error) {
    console.error("Delete error:", error);
    showNotification("❌ Failed to delete goal. Please check if the row exists.", "error");
  }
}

// ============================================
// FILTER UTILITIES
// ============================================

function getAvailableMonths(transactions) {
  const months = new Set();
  transactions.forEach(t => {
    if (t.Date) {
      const month = t.Date.slice(0, 7); // YYYY-MM
      months.add(month);
    }
  });
  return Array.from(months).sort().reverse();
}

function getAvailableYears(transactions) {
  const years = new Set();
  transactions.forEach(t => {
    if (t.Date) {
      const year = t.Date.slice(0, 4); // YYYY
      years.add(year);
    }
  });
  return Array.from(years).sort().reverse();
}

function populateMonthDropdown(selectId, transactions) {
  const select = document.getElementById(selectId);
  if (!select) return;
  
  const months = getAvailableMonths(transactions);
  select.innerHTML = '<option value="">Select Month</option>';
  
  months.forEach(month => {
    const date = new Date(month + "-01");
    const monthName = date.toLocaleDateString("en-IN", { year: "numeric", month: "long" });
    const option = document.createElement("option");
    option.value = month;
    option.textContent = monthName;
    select.appendChild(option);
  });
}

function populateYearDropdown(selectId, transactions) {
  const select = document.getElementById(selectId);
  if (!select) return;
  
  const years = getAvailableYears(transactions);
  select.innerHTML = '<option value="">Select Year</option>';
  
  years.forEach(year => {
    const option = document.createElement("option");
    option.value = year;
    option.textContent = year;
    select.appendChild(option);
  });
}

function filterTransactions(transactions, filter) {
  if (filter.type === "all") {
    return transactions;
  }
  
  return transactions.filter(t => {
    if (!t.Date) return false;
    
    if (filter.type === "month" && filter.month) {
      return t.Date.slice(0, 7) === filter.month;
    }
    
    if (filter.type === "year" && filter.year) {
      return t.Date.slice(0, 4) === filter.year;
    }
    
    return true;
  });
}

function getFilterInfo(filter) {
  if (filter.type === "all") {
    return "Showing all time data";
  }
  
  if (filter.type === "month" && filter.month) {
    const date = new Date(filter.month + "-01");
    const monthName = date.toLocaleDateString("en-IN", { year: "numeric", month: "long" });
    return `Showing data for ${monthName}`;
  }
  
  if (filter.type === "year" && filter.year) {
    return `Showing data for year ${filter.year}`;
  }
  
  return "No filter applied";
}

// ============================================
// DASHBOARD
// ============================================

async function loadDashboard() {
  try {
    const [transactions, investments, sips, fixed, goals] = await Promise.all([
      fetchSheet(CONFIG.SHEETS.TRANSACTIONS),
      fetchSheet(CONFIG.SHEETS.INVESTMENTS),
      fetchSheet(CONFIG.SHEETS.SIP),
      fetchSheet(CONFIG.SHEETS.FIXED),
      fetchSheet(CONFIG.SHEETS.GOALS)
    ]);

    // Populate filter dropdowns
    populateMonthDropdown("dashboardFilterMonth", transactions);
    populateYearDropdown("dashboardFilterYear", transactions);

    // Apply filter
    const filteredTransactions = filterTransactions(transactions, dashboardFilter);
    
    // Update filter info
    const filterInfo = document.getElementById("dashboardFilterInfo");
    if (filterInfo) {
      filterInfo.textContent = getFilterInfo(dashboardFilter);
      filterInfo.className = dashboardFilter.type === "all" ? "filter-info" : "filter-info active";
    }

    // Calculate KPIs
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    let balance = 0;
    const monthlyData = {};

    filteredTransactions.forEach(t => {
      const amount = parseFloat(t.Amount || 0);
      if (t.Type === "Credit") {
        balance += amount;
        monthlyIncome += amount;
      } else {
        balance -= amount;
        monthlyExpense += amount;
      }

      const month = t.Date ? t.Date.slice(0, 7) : currentMonth;
      if (!monthlyData[month]) {
        monthlyData[month] = { income: 0, expense: 0 };
      }
      if (t.Type === "Credit") {
        monthlyData[month].income += amount;
      } else {
        monthlyData[month].expense += amount;
      }
    });

    // Fixed expenses total
    const fixedTotal = fixed
      .filter(f => f.Active === "TRUE" || f.Active === true || f.Active === "true")
      .reduce((sum, f) => sum + parseFloat(f.Amount || 0), 0);

    // SIP commitments
    const sipTotal = sips
      .filter(s => s.Active === "TRUE" || s.Active === true || s.Active === "true")
      .reduce((sum, s) => sum + parseFloat(s.MonthlyAmount || 0), 0);

    // Net worth (balance + investment gains)
    const totalInvested = investments.reduce((sum, inv) => sum + parseFloat(inv.InvestedAmount || 0), 0);
    const totalCurrent = investments.reduce((sum, inv) => sum + parseFloat(inv.CurrentValue || 0), 0);
    const netWorth = balance + (totalCurrent - totalInvested);

    // Update KPI cards
    document.getElementById("balance").textContent = `₹${formatNumber(balance)}`;
    document.getElementById("income").textContent = `₹${formatNumber(monthlyIncome)}`;
    document.getElementById("expense").textContent = `₹${formatNumber(monthlyExpense)}`;
    document.getElementById("fixed").textContent = `₹${formatNumber(fixedTotal)}`;
    document.getElementById("sip").textContent = `₹${formatNumber(sipTotal)}`;
    document.getElementById("networth").textContent = `₹${formatNumber(netWorth)}`;

    // Render charts
    renderCashflowChart(monthlyData);
    renderReturnsChart(investments);
    renderNetworthChart(filteredTransactions, investments);

    // Generate insights
    generateInsights(filteredTransactions, fixedTotal, sipTotal, monthlyIncome, investments, goals);
  } catch (error) {
    console.error("Error loading dashboard:", error);
    showNotification("❌ Failed to load dashboard data.", "error");
  }
}

// ============================================
// CHARTS
// ============================================

function renderCashflowChart(monthlyData) {
  const ctx = document.getElementById("cashflowChart");
  if (!ctx) return;

  const months = Object.keys(monthlyData).sort();
  const incomeData = months.map(m => monthlyData[m].income);
  const expenseData = months.map(m => monthlyData[m].expense);

  if (cashflowChart) {
    cashflowChart.destroy();
  }

  cashflowChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: months,
      datasets: [
        {
          label: "Income",
          data: incomeData,
          borderColor: "#4CAF50",
          backgroundColor: "rgba(76, 175, 80, 0.1)",
          tension: 0.4
        },
        {
          label: "Expense",
          data: expenseData,
          borderColor: "#f44336",
          backgroundColor: "rgba(244, 67, 54, 0.1)",
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true, position: "top" }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return "₹" + formatNumber(value);
            }
          }
        }
      }
    }
  });
}

function renderReturnsChart(investments) {
  const ctx = document.getElementById("returnsChart");
  if (!ctx || investments.length === 0) return;

  const returns = investments.map(inv => {
    const invested = parseFloat(inv.InvestedAmount || 0);
    const current = parseFloat(inv.CurrentValue || 0);
    const date = new Date(inv.Date);
    const now = new Date();
    const years = (now - date) / (365.25 * 24 * 60 * 60 * 1000);
    return {
      asset: inv.Asset || "Unknown",
      cagr: calculateCAGR(invested, current, years),
      gain: current - invested
    };
  });

  if (returnsChart) {
    returnsChart.destroy();
  }

  returnsChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: returns.map(r => r.asset),
      datasets: [
        {
          label: "CAGR %",
          data: returns.map(r => r.cagr),
          backgroundColor: returns.map(r => r.cagr >= 0 ? "#4CAF50" : "#f44336")
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: {
          ticks: {
            callback: function(value) {
              return value.toFixed(2) + "%";
            }
          }
        }
      }
    }
  });
}

function renderNetworthChart(transactions, investments) {
  const ctx = document.getElementById("networthChart");
  if (!ctx) return;

  const monthlyNetworth = {};
  let runningBalance = 0;

  // Process transactions chronologically
  const sortedTxns = [...transactions].sort((a, b) => 
    (a.Date || "").localeCompare(b.Date || "")
  );

  sortedTxns.forEach(t => {
    const month = t.Date ? t.Date.slice(0, 7) : "";
    if (!month) return;

    const amount = parseFloat(t.Amount || 0);
    runningBalance += t.Type === "Credit" ? amount : -amount;

    if (!monthlyNetworth[month]) {
      monthlyNetworth[month] = runningBalance;
    } else {
      monthlyNetworth[month] = runningBalance;
    }
  });

  // Add investment gains
  const totalInvested = investments.reduce((sum, inv) => sum + parseFloat(inv.InvestedAmount || 0), 0);
  const totalCurrent = investments.reduce((sum, inv) => sum + parseFloat(inv.CurrentValue || 0), 0);
  const investmentGain = totalCurrent - totalInvested;

  const months = Object.keys(monthlyNetworth).sort();
  const networthData = months.map(m => monthlyNetworth[m] + investmentGain);

  if (networthChart) {
    networthChart.destroy();
  }

  networthChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: months,
      datasets: [
        {
          label: "Net Worth",
          data: networthData,
          borderColor: "#2196F3",
          backgroundColor: "rgba(33, 150, 243, 0.1)",
          fill: true,
          tension: 0.4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: true, position: "top" }
      },
      scales: {
        y: {
          beginAtZero: false,
          ticks: {
            callback: function(value) {
              return "₹" + formatNumber(value);
            }
          }
        }
      }
    }
  });
}

// ============================================
// RETURNS ENGINE
// ============================================

function calculateCAGR(invested, current, years) {
  if (invested <= 0 || years <= 0) return 0;
  if (current <= 0) return -100;
  return ((Math.pow(current / invested, 1 / years) - 1) * 100);
}

function calculateXIRR(cashflows, dates) {
  if (cashflows.length !== dates.length || cashflows.length < 2) return 0;
  
  // Convert dates to years from first date
  const firstDate = new Date(dates[0]);
  const years = dates.map(d => {
    const date = new Date(d);
    return (date - firstDate) / (365.25 * 24 * 60 * 60 * 1000);
  });

  // Newton-Raphson method for XIRR
  let rate = 0.1; // Initial guess
  const tolerance = 0.0001;
  const maxIterations = 100;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let npvDerivative = 0;

    for (let j = 0; j < cashflows.length; j++) {
      const factor = Math.pow(1 + rate, years[j]);
      npv += cashflows[j] / factor;
      npvDerivative -= (years[j] * cashflows[j]) / (factor * (1 + rate));
    }

    if (Math.abs(npv) < tolerance) break;

    const newRate = rate - npv / npvDerivative;
    if (isNaN(newRate) || !isFinite(newRate)) break;
    rate = newRate;
  }

  return rate * 100;
}

// ============================================
// AI INSIGHTS
// ============================================

function generateInsights(transactions, fixedTotal, sipTotal, income, investments, goals) {
  const container = document.getElementById("insights");
  if (!container) return;

  const insights = [];

  // Highest spending category
  const categorySpend = {};
  transactions.forEach(t => {
    if (t.Type === "Debit") {
      const cat = t.Category || "Uncategorized";
      categorySpend[cat] = (categorySpend[cat] || 0) + parseFloat(t.Amount || 0);
    }
  });

  const topCategory = Object.entries(categorySpend)
    .sort((a, b) => b[1] - a[1])[0];
  
  if (topCategory) {
    insights.push({
      type: "info",
      message: `📊 Highest spending category is <strong>${topCategory[0]}</strong> (₹${formatNumber(topCategory[1])}).`
    });
  }

  // Fixed + SIP burden
  if (income > 0) {
    const locked = fixedTotal + sipTotal;
    const burdenPercent = (locked / income) * 100;
    
    if (burdenPercent > 60) {
      insights.push({
        type: "warning",
        message: `⚠️ Fixed expenses + SIP commitments (₹${formatNumber(locked)}) exceed ${burdenPercent.toFixed(1)}% of income. Cashflow may be tight.`
      });
    } else if (burdenPercent > 40) {
      insights.push({
        type: "info",
        message: `ℹ️ Fixed expenses + SIP commitments are ${burdenPercent.toFixed(1)}% of income. Monitor cashflow.`
      });
    }
  }

  // Savings rate
  if (income > 0) {
    const totalExpenses = transactions
      .filter(t => t.Type === "Debit")
      .reduce((sum, t) => sum + parseFloat(t.Amount || 0), 0);
    const savings = income - totalExpenses;
    const savingsRate = (savings / income) * 100;

    if (savingsRate >= 30) {
      insights.push({
        type: "success",
        message: `✅ Excellent savings rate of ${savingsRate.toFixed(1)}%. You're managing money well!`
      });
    } else if (savingsRate >= 20) {
      insights.push({
        type: "info",
        message: `ℹ️ Good savings rate of ${savingsRate.toFixed(1)}%. Consider increasing if possible.`
      });
    } else if (savingsRate >= 10) {
      insights.push({
        type: "warning",
        message: `⚠️ Savings rate is ${savingsRate.toFixed(1)}%. Try to increase discretionary savings.`
      });
    } else {
      insights.push({
        type: "error",
        message: `❌ Very low savings rate of ${savingsRate.toFixed(1)}%. Consider reducing expenses.`
      });
    }
  }

  // Investment performance
  if (investments.length > 0) {
    const totalInvested = investments.reduce((sum, inv) => sum + parseFloat(inv.InvestedAmount || 0), 0);
    const totalCurrent = investments.reduce((sum, inv) => sum + parseFloat(inv.CurrentValue || 0), 0);
    const totalGain = totalCurrent - totalInvested;
    const gainPercent = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0;

    if (gainPercent > 15) {
      insights.push({
        type: "success",
        message: `📈 Investment portfolio is performing well with ${gainPercent.toFixed(2)}% overall returns.`
      });
    } else if (gainPercent < -5) {
      insights.push({
        type: "warning",
        message: `📉 Investment portfolio is down ${Math.abs(gainPercent).toFixed(2)}%. Review your strategy.`
      });
    }
  }

  // Goals progress
  if (goals.length > 0) {
    const achievedGoals = goals.filter(g => {
      const current = parseFloat(g.CurrentAmount || 0);
      const target = parseFloat(g.TargetAmount || 0);
      return current >= target;
    }).length;

    if (achievedGoals > 0) {
      insights.push({
        type: "success",
        message: `🎯 ${achievedGoals} goal${achievedGoals > 1 ? "s" : ""} achieved! Keep up the great work!`
      });
    }

    const atRiskGoals = goals.filter(g => {
      const current = parseFloat(g.CurrentAmount || 0);
      const target = parseFloat(g.TargetAmount || 0);
      const progress = target > 0 ? (current / target) * 100 : 0;
      const deadline = g.Deadline ? new Date(g.Deadline) : null;
      if (!deadline) return false;
      const now = new Date();
      const daysRemaining = Math.ceil((deadline - now) / (1000 * 60 * 60 * 24));
      const monthlyNeeded = daysRemaining > 0 ? (target - current) / (daysRemaining / 30) : 0;
      return progress < 50 && monthlyNeeded > (target * 0.1);
    }).length;

    if (atRiskGoals > 0) {
      insights.push({
        type: "warning",
        message: `⚠️ ${atRiskGoals} goal${atRiskGoals > 1 ? "s" : ""} ${atRiskGoals > 1 ? "are" : "is"} at risk. Consider adjusting targets or increasing contributions.`
      });
    }
  }

  // Cashflow risk
  if (income > 0) {
    const monthlyExpense = transactions
      .filter(t => t.Type === "Debit")
      .reduce((sum, t) => sum + parseFloat(t.Amount || 0), 0);
    const emergencyMonths = monthlyExpense > 0 
      ? (transactions.filter(t => t.Type === "Credit").reduce((sum, t) => sum + parseFloat(t.Amount || 0), 0) - monthlyExpense) / monthlyExpense
      : 0;

    if (emergencyMonths < 3) {
      insights.push({
        type: "error",
        message: `🚨 Low emergency fund. Aim for at least 3-6 months of expenses in reserves.`
      });
    }
  }

  // Render insights
  if (insights.length === 0) {
    container.innerHTML = '<div class="insight-card info">No insights available yet. Add more data to get personalized insights.</div>';
  } else {
    container.innerHTML = insights.map(insight => {
      const typeClass = insight.type || "info";
      return `<div class="insight-card ${typeClass}">${insight.message}</div>`;
    }).join("");
  }
}

// ============================================
// UTILITIES
// ============================================

function formatNumber(num) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  }).format(num);
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-IN", { year: "numeric", month: "short", day: "numeric" });
}

function showNotification(message, type = "success") {
  // Simple notification - can be enhanced with a toast library
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.textContent = message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    padding: 12px 24px;
    background: ${type === "error" ? "#f44336" : "#4CAF50"};
    color: white;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    z-index: 10000;
    animation: slideIn 0.3s ease;
  `;
  
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = "slideOut 0.3s ease";
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

// ============================================
// PDF REPORT
// ============================================

function downloadPDF() {
  window.print();
}

// ============================================
// INITIALIZATION
// ============================================

function initializeApp() {
  // Set default dates
  const today = new Date().toISOString().split("T")[0];
  const txnDateInput = document.getElementById("txnDate");
  const invDateInput = document.getElementById("invDate");
  const sipStartDateInput = document.getElementById("sipStartDate");
  
  if (txnDateInput) txnDateInput.value = today;
  if (invDateInput) invDateInput.value = today;
  if (sipStartDateInput) sipStartDateInput.value = today;

  // Load dashboard
  loadDashboard();

  // Setup event listeners
  setupEventListeners();
}

function setupEventListeners() {
  // Login
  const loginBtn = document.getElementById("loginBtn");
  const pinInput = document.getElementById("pinInput");
  if (loginBtn) {
    loginBtn.addEventListener("click", login);
  }
  if (pinInput) {
    pinInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") login();
    });
  }

  // Logout
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", logout);
  }

  // PIN change
  const changePinBtn = document.getElementById("changePinBtn");
  const savePinBtn = document.getElementById("savePinBtn");
  const cancelPinBtn = document.getElementById("cancelPinBtn");
  if (changePinBtn) {
    changePinBtn.addEventListener("click", togglePinChange);
  }
  if (savePinBtn) {
    savePinBtn.addEventListener("click", changePin);
  }
  if (cancelPinBtn) {
    cancelPinBtn.addEventListener("click", togglePinChange);
  }

  // ============================
  // CHANGE API CONNECTION
  // ============================
  const changeApiBtn = document.getElementById("changeApiBtn");
  const saveApiBtn = document.getElementById("saveApiBtn");
  const cancelApiBtn = document.getElementById("cancelApiBtn");
  const apiChangeBox = document.getElementById("apiChangeBox");
  const apiBaseInput = document.getElementById("apiBaseInput");

  if (changeApiBtn && apiChangeBox && apiBaseInput) {
    changeApiBtn.addEventListener("click", () => {
      apiChangeBox.style.display = "block";
      const pinBox = document.getElementById("pinChangeBox");
      if (pinBox) pinBox.style.display = "none";
      apiBaseInput.value = getApiBase() || "";
    });
  }

  if (cancelApiBtn && apiChangeBox) {
    cancelApiBtn.addEventListener("click", () => {
      apiChangeBox.style.display = "none";
    });
  }

  if (saveApiBtn && apiBaseInput && apiChangeBox) {
    saveApiBtn.addEventListener("click", () => {
      const api = apiBaseInput.value.trim();

      if (!api) {
        alert("❌ API URL cannot be empty.");
        return;
      }

      if (!api.startsWith("https://sheetdb.io/api/")) {
        alert("❌ Please enter a valid SheetDB API URL.");
        return;
      }

      setApiBase(api);
      apiChangeBox.style.display = "none";
      showNotification("✅ API connection updated successfully!");

      // Reload everything with new API
      loadDashboard();
    });
  }

  // Tab navigation
  document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const tabId = btn.getAttribute("data-tab");
      if (tabId) showTab(tabId);
    });
  });

  // Forms
  const txnForm = document.getElementById("txnForm");
  if (txnForm) {
    txnForm.addEventListener("submit", addTransaction);
  }

  const investmentForm = document.getElementById("investmentForm");
  if (investmentForm) {
    investmentForm.addEventListener("submit", addInvestment);
  }

  const sipForm = document.getElementById("sipForm");
  if (sipForm) {
    sipForm.addEventListener("submit", addSIP);
  }

  const fixedForm = document.getElementById("fixedForm");
  if (fixedForm) {
    fixedForm.addEventListener("submit", addFixedExpense);
  }

  const goalForm = document.getElementById("goalForm");
  if (goalForm) {
    goalForm.addEventListener("submit", addGoal);
  }

  // PDF download
  const downloadReportBtn = document.getElementById("downloadReportBtn");
  if (downloadReportBtn) {
    downloadReportBtn.addEventListener("click", downloadPDF);
  }

  // Dashboard filter controls
  const dashboardFilterType = document.getElementById("dashboardFilterType");
  const dashboardFilterMonth = document.getElementById("dashboardFilterMonth");
  const dashboardFilterYear = document.getElementById("dashboardFilterYear");
  const applyDashboardFilter = document.getElementById("applyDashboardFilter");
  const resetDashboardFilter = document.getElementById("resetDashboardFilter");

  if (dashboardFilterType) {
    dashboardFilterType.addEventListener("change", (e) => {
      const type = e.target.value;
      if (type === "month") {
        dashboardFilterMonth.style.display = "block";
        dashboardFilterYear.style.display = "none";
      } else if (type === "year") {
        dashboardFilterMonth.style.display = "none";
        dashboardFilterYear.style.display = "block";
      } else {
        dashboardFilterMonth.style.display = "none";
        dashboardFilterYear.style.display = "none";
      }
    });
  }

  if (applyDashboardFilter) {
    applyDashboardFilter.addEventListener("click", () => {
      const type = dashboardFilterType?.value || "all";
      const month = dashboardFilterMonth?.value || "";
      const year = dashboardFilterYear?.value || "";
      
      dashboardFilter = { type, month, year };
      loadDashboard();
    });
  }

  if (resetDashboardFilter) {
    resetDashboardFilter.addEventListener("click", () => {
      dashboardFilter = { type: "all", month: "", year: "" };
      if (dashboardFilterType) dashboardFilterType.value = "all";
      if (dashboardFilterMonth) {
        dashboardFilterMonth.value = "";
        dashboardFilterMonth.style.display = "none";
      }
      if (dashboardFilterYear) {
        dashboardFilterYear.value = "";
        dashboardFilterYear.style.display = "none";
      }
      loadDashboard();
    });
  }

  // Transaction filter controls
  const txnFilterType = document.getElementById("txnFilterType");
  const txnFilterMonth = document.getElementById("txnFilterMonth");
  const txnFilterYear = document.getElementById("txnFilterYear");
  const applyTxnFilter = document.getElementById("applyTxnFilter");
  const resetTxnFilter = document.getElementById("resetTxnFilter");

  if (txnFilterType) {
    txnFilterType.addEventListener("change", (e) => {
      const type = e.target.value;
      if (type === "month") {
        txnFilterMonth.style.display = "block";
        txnFilterYear.style.display = "none";
      } else if (type === "year") {
        txnFilterMonth.style.display = "none";
        txnFilterYear.style.display = "block";
      } else {
        txnFilterMonth.style.display = "none";
        txnFilterYear.style.display = "none";
      }
    });
  }

  if (applyTxnFilter) {
    applyTxnFilter.addEventListener("click", () => {
      const type = txnFilterType?.value || "all";
      const month = txnFilterMonth?.value || "";
      const year = txnFilterYear?.value || "";
      
      txnFilter = { type, month, year };
      loadTransactions();
    });
  }

  if (resetTxnFilter) {
    resetTxnFilter.addEventListener("click", () => {
      txnFilter = { type: "all", month: "", year: "" };
      if (txnFilterType) txnFilterType.value = "all";
      if (txnFilterMonth) {
        txnFilterMonth.value = "";
        txnFilterMonth.style.display = "none";
      }
      if (txnFilterYear) {
        txnFilterYear.value = "";
        txnFilterYear.style.display = "none";
      }
      loadTransactions();
    });
  }
}

// ============================================
// SERVICE WORKER REGISTRATION
// ============================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js")
      .then(reg => {
        console.log("✅ Service Worker registered:", reg);
        // Check for updates
        reg.addEventListener("updatefound", () => {
          console.log("🔄 Service Worker update found");
        });
      })
      .catch(err => console.error("❌ Service Worker registration failed:", err));
  });
}

// ============================================
// PWA INSTALL PROMPT
// ============================================

let deferredPrompt = null;

window.addEventListener("beforeinstallprompt", (e) => {
  // Prevent the mini-infobar from appearing
  e.preventDefault();
  // Stash the event so it can be triggered later
  deferredPrompt = e;
  // Show install button
  const installBtn = document.getElementById("installBtn");
  if (installBtn) {
    installBtn.style.display = "block";
  }
  console.log("📱 PWA install prompt available");
});

// Handle install button click
window.addEventListener("load", () => {
  const installBtn = document.getElementById("installBtn");
  if (installBtn) {
    installBtn.addEventListener("click", async () => {
      if (!deferredPrompt) {
        // If prompt was already shown, try manual installation instructions
        showNotification("📱 To install: Use browser menu → Install App (or Add to Home Screen)", "info");
        return;
      }
      
      // Show the install prompt
      deferredPrompt.prompt();
      
      // Wait for the user to respond
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`User response to install prompt: ${outcome}`);
      
      if (outcome === "accepted") {
        showNotification("✅ App installed successfully!", "success");
      } else {
        showNotification("ℹ️ Installation cancelled", "info");
      }
      
      // Clear the deferredPrompt
      deferredPrompt = null;
      installBtn.style.display = "none";
    });
  }
  
  // Hide install button if app is already installed
  if (window.matchMedia("(display-mode: standalone)").matches) {
    const installBtn = document.getElementById("installBtn");
    if (installBtn) {
      installBtn.style.display = "none";
    }
    console.log("📱 App is already installed");
  }
});

// ============================================
// SESSION RESTORE
// ============================================

(function restoreSession() {
  if (isAuthenticated()) {
    const loginBox = document.getElementById("loginBox");
    const app = document.getElementById("app");
    if (loginBox && app) {
      loginBox.style.display = "none";
      app.style.display = "block";
      initializeApp();
    }
  }
})();

function showApiBasePopup() {
  let api = prompt(
    "🔗 Enter your SheetDB API URL\n\nExample:\nhttps://sheetdb.io/api/v1/xxxxxxxx",
    ""
  );

  if (!api) {
    alert("❌ API URL is required to continue.");
    logout();
    return;
  }

  api = api.trim();
  if (!api.startsWith("https://sheetdb.io/api/")) {
    alert("❌ Invalid SheetDB API URL.");
    showApiBasePopup();
    return;
  }

  setApiBase(api);
  showNotification("✅ API connected successfully!");
  initializeApp();
}