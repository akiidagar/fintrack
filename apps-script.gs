// ============================================
// FinTrack - Google Apps Script Automation
// ============================================
// This script automates:
// 1. Monthly SIP transaction posting
// 2. Monthly fixed expense posting
// 3. Email alerts before due dates
// ============================================

// CONFIGURATION
const CONFIG = {
  // SheetDB API endpoint (replace with your SheetDB API URL)
  SHEETDB_API: "https://sheetdb.io/api/v1/YOUR_API_ID",
  
  // Email configuration
  EMAIL_FROM: "fintrack@yourdomain.com", // Update with your email
  EMAIL_SUBJECT_PREFIX: "[FinTrack] ",
  
  // Alert days before due date
  ALERT_DAYS_BEFORE: 3
};

// ============================================
// SHEET REFERENCES
// ============================================
// Assuming you have a Google Sheet with these sheets:
// - Transactions (main sheet)
// - SIP
// - FixedExpenses

function getSheet(sheetName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  return ss.getSheetByName(sheetName) || ss.insertSheet(sheetName);
}

// ============================================
// SIP AUTOMATION
// ============================================

/**
 * Main function to process SIP transactions
 * Run this monthly via time-based trigger
 */
function processSIPTransactions() {
  try {
    const sipSheet = getSheet("SIP");
    const transactionSheet = getSheet("Transactions");
    
    // Get all active SIPs
    const sips = getActiveSIPs(sipSheet);
    const today = new Date();
    const currentMonth = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM");
    
    Logger.log(`Processing ${sips.length} active SIPs for ${currentMonth}`);
    
    sips.forEach((sip, index) => {
      const rowIndex = sip.rowIndex;
      const debitDay = parseInt(sip.debitDay);
      const lastPosted = sip.lastPostedMonth;
      
      // Check if already posted this month
      if (lastPosted === currentMonth) {
        Logger.log(`SIP ${sip.asset} already posted for ${currentMonth}`);
        return;
      }
      
      // Check if today is the debit day or past it
      const todayDay = today.getDate();
      if (todayDay >= debitDay) {
        // Post the transaction
        postSIPTransaction(sip, transactionSheet, currentMonth);
        
        // Update last posted month
        sipSheet.getRange(rowIndex, getColumnIndex(sipSheet, "LastPostedMonth")).setValue(currentMonth);
        
        Logger.log(`Posted SIP transaction: ${sip.asset} - ₹${sip.amount}`);
      } else {
        Logger.log(`SIP ${sip.asset} debit day (${debitDay}) not reached yet`);
      }
    });
    
    Logger.log("SIP processing completed");
  } catch (error) {
    Logger.log(`Error processing SIPs: ${error.toString()}`);
    sendErrorEmail("SIP Processing Error", error.toString());
  }
}

/**
 * Get all active SIPs from the sheet
 */
function getActiveSIPs(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const assetCol = headers.indexOf("Asset");
  const amountCol = headers.indexOf("MonthlyAmount");
  const debitDayCol = headers.indexOf("DebitDay");
  const activeCol = headers.indexOf("Active");
  const lastPostedCol = headers.indexOf("LastPostedMonth");
  
  const sips = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const isActive = row[activeCol] === "TRUE" || row[activeCol] === true || row[activeCol] === "true";
    
    if (isActive && row[assetCol]) {
      sips.push({
        rowIndex: i + 1,
        asset: row[assetCol],
        amount: parseFloat(row[amountCol] || 0),
        debitDay: row[debitDayCol],
        lastPostedMonth: row[lastPostedCol] || "",
        duration: row[headers.indexOf("Duration")] || 0
      });
    }
  }
  
  return sips;
}

/**
 * Post a SIP transaction to the Transactions sheet
 */
function postSIPTransaction(sip, transactionSheet, month) {
  const today = new Date();
  const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  // Prepare transaction data
  const transaction = {
    Date: dateStr,
    Type: "Debit",
    Category: "SIP",
    Description: `SIP - ${sip.asset}`,
    Amount: sip.amount,
    Source: "SIP"
  };
  
  // Add to sheet
  const headers = transactionSheet.getRange(1, 1, 1, transactionSheet.getLastColumn()).getValues()[0];
  const newRow = [];
  
  headers.forEach(header => {
    newRow.push(transaction[header] || "");
  });
  
  transactionSheet.appendRow(newRow);
  
  // If using SheetDB API, also post via API
  postToSheetDB("Transactions", transaction);
}

// ============================================
// FIXED EXPENSES AUTOMATION
// ============================================

/**
 * Main function to process fixed expenses
 * Run this monthly via time-based trigger
 */
function processFixedExpenses() {
  try {
    const fixedSheet = getSheet("FixedExpenses");
    const transactionSheet = getSheet("Transactions");
    
    const fixedExpenses = getActiveFixedExpenses(fixedSheet);
    const today = new Date();
    const currentMonth = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM");
    
    Logger.log(`Processing ${fixedExpenses.length} active fixed expenses for ${currentMonth}`);
    
    fixedExpenses.forEach((expense) => {
      const rowIndex = expense.rowIndex;
      const dueDay = parseInt(expense.dueDay);
      const lastPosted = expense.lastPostedMonth;
      
      // Check if already posted this month
      if (lastPosted === currentMonth) {
        Logger.log(`Fixed expense ${expense.name} already posted for ${currentMonth}`);
        return;
      }
      
      // Check if today is the due day or past it
      const todayDay = today.getDate();
      if (todayDay >= dueDay) {
        // Post the transaction
        postFixedExpenseTransaction(expense, transactionSheet, currentMonth);
        
        // Update last posted month
        fixedSheet.getRange(rowIndex, getColumnIndex(fixedSheet, "LastPostedMonth")).setValue(currentMonth);
        
        Logger.log(`Posted fixed expense: ${expense.name} - ₹${expense.amount}`);
      } else {
        Logger.log(`Fixed expense ${expense.name} due day (${dueDay}) not reached yet`);
      }
    });
    
    Logger.log("Fixed expenses processing completed");
  } catch (error) {
    Logger.log(`Error processing fixed expenses: ${error.toString()}`);
    sendErrorEmail("Fixed Expenses Processing Error", error.toString());
  }
}

/**
 * Get all active fixed expenses from the sheet
 */
function getActiveFixedExpenses(sheet) {
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  const nameCol = headers.indexOf("Name");
  const amountCol = headers.indexOf("Amount");
  const dueDayCol = headers.indexOf("DueDay");
  const activeCol = headers.indexOf("Active");
  const lastPostedCol = headers.indexOf("LastPostedMonth");
  const emailCol = headers.indexOf("Email");
  
  const expenses = [];
  
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const isActive = row[activeCol] === "TRUE" || row[activeCol] === true || row[activeCol] === "true";
    
    if (isActive && row[nameCol]) {
      expenses.push({
        rowIndex: i + 1,
        name: row[nameCol],
        amount: parseFloat(row[amountCol] || 0),
        dueDay: row[dueDayCol],
        lastPostedMonth: row[lastPostedCol] || "",
        email: row[emailCol] || ""
      });
    }
  }
  
  return expenses;
}

/**
 * Post a fixed expense transaction to the Transactions sheet
 */
function postFixedExpenseTransaction(expense, transactionSheet, month) {
  const today = new Date();
  const dateStr = Utilities.formatDate(today, Session.getScriptTimeZone(), "yyyy-MM-dd");
  
  // Prepare transaction data
  const transaction = {
    Date: dateStr,
    Type: "Debit",
    Category: "Fixed Expense",
    Description: expense.name,
    Amount: expense.amount,
    Source: "Fixed"
  };
  
  // Add to sheet
  const headers = transactionSheet.getRange(1, 1, 1, transactionSheet.getLastColumn()).getValues()[0];
  const newRow = [];
  
  headers.forEach(header => {
    newRow.push(transaction[header] || "");
  });
  
  transactionSheet.appendRow(newRow);
  
  // If using SheetDB API, also post via API
  postToSheetDB("Transactions", transaction);
}

// ============================================
// EMAIL ALERTS
// ============================================

/**
 * Send email alerts for upcoming fixed expenses
 * Run this daily via time-based trigger
 */
function sendFixedExpenseAlerts() {
  try {
    const fixedSheet = getSheet("FixedExpenses");
    const fixedExpenses = getActiveFixedExpenses(fixedSheet);
    const today = new Date();
    const todayDay = today.getDate();
    
    fixedExpenses.forEach(expense => {
      const dueDay = parseInt(expense.dueDay);
      const daysUntilDue = dueDay - todayDay;
      
      // Send alert if within alert window
      if (daysUntilDue >= 0 && daysUntilDue <= CONFIG.ALERT_DAYS_BEFORE) {
        if (expense.email) {
          sendFixedExpenseAlert(expense, daysUntilDue);
        }
      }
    });
    
    Logger.log("Fixed expense alerts sent");
  } catch (error) {
    Logger.log(`Error sending alerts: ${error.toString()}`);
  }
}

/**
 * Send alert email for a fixed expense
 */
function sendFixedExpenseAlert(expense, daysUntilDue) {
  const subject = `${CONFIG.EMAIL_SUBJECT_PREFIX}Fixed Expense Due: ${expense.name}`;
  const body = `
    <h2>Fixed Expense Reminder</h2>
    <p><strong>Expense:</strong> ${expense.name}</p>
    <p><strong>Amount:</strong> ₹${expense.amount.toFixed(2)}</p>
    <p><strong>Due Day:</strong> ${expense.dueDay}</p>
    <p><strong>Days Until Due:</strong> ${daysUntilDue} day(s)</p>
    <p>This expense will be automatically posted on the due date.</p>
    <hr>
    <p><em>This is an automated message from FinTrack.</em></p>
  `;
  
  MailApp.sendEmail({
    to: expense.email,
    subject: subject,
    htmlBody: body
  });
  
  Logger.log(`Alert sent to ${expense.email} for ${expense.name}`);
}

// ============================================
// SHEETDB API INTEGRATION
// ============================================

/**
 * Post data to SheetDB API
 */
function postToSheetDB(sheetName, data) {
  try {
    const url = CONFIG.SHEETDB_API + (sheetName ? `?sheet=${sheetName}` : "");
    const payload = {
      data: data
    };
    
    const options = {
      method: "post",
      contentType: "application/json",
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const result = JSON.parse(response.getContentText());
    
    if (response.getResponseCode() !== 201) {
      Logger.log(`SheetDB API error: ${JSON.stringify(result)}`);
    } else {
      Logger.log(`Posted to SheetDB: ${JSON.stringify(data)}`);
    }
  } catch (error) {
    Logger.log(`Error posting to SheetDB: ${error.toString()}`);
  }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get column index by header name
 */
function getColumnIndex(sheet, headerName) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const index = headers.indexOf(headerName);
  return index >= 0 ? index + 1 : 1;
}

/**
 * Send error notification email
 */
function sendErrorEmail(subject, errorMessage) {
  try {
    const adminEmail = Session.getActiveUser().getEmail();
    MailApp.sendEmail({
      to: adminEmail,
      subject: `${CONFIG.EMAIL_SUBJECT_PREFIX}${subject}`,
      body: `An error occurred in FinTrack automation:\n\n${errorMessage}\n\nTime: ${new Date().toString()}`
    });
  } catch (error) {
    Logger.log(`Failed to send error email: ${error.toString()}`);
  }
}

// ============================================
// TRIGGER SETUP
// ============================================

/**
 * Setup time-based triggers
 * Run this once to set up automation
 */
function setupTriggers() {
  // Delete existing triggers
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === "processSIPTransactions" ||
        trigger.getHandlerFunction() === "processFixedExpenses" ||
        trigger.getHandlerFunction() === "sendFixedExpenseAlerts") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  
  // Create monthly trigger for SIP processing (runs on 1st of each month)
  ScriptApp.newTrigger("processSIPTransactions")
    .timeBased()
    .onMonthDay(1)
    .atHour(9)
    .create();
  
  // Create monthly trigger for fixed expenses (runs on 1st of each month)
  ScriptApp.newTrigger("processFixedExpenses")
    .timeBased()
    .onMonthDay(1)
    .atHour(9)
    .create();
  
  // Create daily trigger for email alerts (runs daily at 8 AM)
  ScriptApp.newTrigger("sendFixedExpenseAlerts")
    .timeBased()
    .everyDays(1)
    .atHour(8)
    .create();
  
  Logger.log("Triggers setup completed");
}

/**
 * Manual test function
 */
function testAutomation() {
  Logger.log("Testing SIP processing...");
  processSIPTransactions();
  
  Logger.log("Testing fixed expenses processing...");
  processFixedExpenses();
  
  Logger.log("Testing email alerts...");
  sendFixedExpenseAlerts();
  
  Logger.log("Test completed");
}
