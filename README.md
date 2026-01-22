# FinTrack - Personal Finance Management PWA

A production-ready, offline-capable Progressive Web App for personal finance management using Google Sheets as the database.

## 🎯 Features

- **📊 Dashboard**: Real-time KPIs, charts, and AI-powered insights
- **💳 Transactions**: Full CRUD operations for income and expenses
- **📈 Investments**: Track investments with CAGR calculations
- **🔁 SIP Management**: Automated monthly SIP transactions
- **📌 Fixed Expenses**: Automated recurring expense posting
- **🎯 Goals**: Financial goal tracking with progress visualization
- **🧠 AI Insights**: Rule-based financial analysis (no external API)
- **📱 PWA**: Installable, offline-capable, works on all devices
- **🔐 Security**: PIN-based authentication (extensible to OAuth)

## 🏗️ Architecture

### Frontend (GitHub Pages)
- `index.html` - Pure UI (no inline JavaScript)
- `style.css` - Modern, responsive styling
- `app.js` - All application logic
- `manifest.json` - PWA configuration
- `sw.js` - Service Worker for offline support

### Backend (Serverless)
- **Google Sheets** - Primary database
- **SheetDB** - REST API layer
- **Google Apps Script** - Automation (SIP, Fixed Expenses, Email Alerts)

## 🚀 Setup Instructions

### 1. Google Sheets Setup

1. Create a new Google Sheet
2. Create the following sheets (tabs):
   - **Transactions** (default sheet)
   - **Investments**
   - **SIP**
   - **FixedExpenses**
   - **Goals**

3. Set up column headers:

   **Transactions:**
   - Date, Type, Category, Description, Amount, Source

   **Investments:**
   - Date, Asset, InvestedAmount, CurrentValue, Notes

   **SIP:**
   - Asset, MonthlyAmount, DebitDay, Duration, Active, LastPostedMonth

   **FixedExpenses:**
   - Name, Amount, DueDay, Email, Active, LastPostedMonth

   **Goals:**
   - Goal, TargetAmount, CurrentAmount, Deadline

### 2. SheetDB Setup

1. Go to [SheetDB.io](https://sheetdb.io)
2. Create a new API
3. Connect your Google Sheet
4. Copy your API endpoint
5. Update `CONFIG.API_BASE` in `app.js`:

```javascript
const CONFIG = {
  API_BASE: "https://sheetdb.io/api/v1/YOUR_API_ID",
  // ...
};
```

### 3. Google Apps Script Setup

1. Open your Google Sheet
2. Go to **Extensions → Apps Script**
3. Copy the contents of `apps-script.gs` into the script editor
4. Update the configuration:
   ```javascript
   const CONFIG = {
     SHEETDB_API: "https://sheetdb.io/api/v1/YOUR_API_ID",
     EMAIL_FROM: "your-email@domain.com",
     // ...
   };
   ```
5. Run `setupTriggers()` function once to create automation triggers
6. Authorize the script when prompted

### 4. PWA Icons

Create an `icons` folder and add the following icon sizes:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

You can use a tool like [PWA Asset Generator](https://github.com/onderceylan/pwa-asset-generator) to generate these.

### 5. GitHub Pages Deployment

1. Create a new GitHub repository
2. Push all files to the repository
3. Go to **Settings → Pages**
4. Select source branch (usually `main`)
5. Your app will be available at `https://yourusername.github.io/repository-name`

### 6. HTTPS Requirement

PWAs require HTTPS. GitHub Pages provides this automatically. For local development:
- Use a local server with HTTPS (e.g., `npx serve -s . --ssl-cert cert.pem --ssl-key key.pem`)
- Or use `localhost` (HTTPS not required for localhost)

## 📖 Usage

### First Login
- Default PIN: `1234`
- Change PIN after first login via Dashboard → Change PIN

### Adding Transactions
1. Go to **Transactions** tab
2. Fill in the form (Date, Type, Category, Description, Amount)
3. Click **Add Transaction**

### Managing Investments
1. Go to **Investments** tab
2. Add investment details (Date, Asset, Invested Amount, Current Value)
3. CAGR is calculated automatically

### Setting Up SIP
1. Go to **SIP** tab
2. Add SIP details:
   - Asset name
   - Monthly amount
   - Debit day (1-28)
   - Duration (0 for indefinite)
   - Active status
3. Google Apps Script will auto-post transactions monthly

### Setting Up Fixed Expenses
1. Go to **Fixed Expenses** tab
2. Add expense details:
   - Name (e.g., Rent, EMI)
   - Monthly amount
   - Due day (1-31)
   - Email for alerts (optional)
   - Active status
3. Google Apps Script will:
   - Auto-post transactions monthly
   - Send email alerts before due dates

### Tracking Goals
1. Go to **Goals** tab
2. Add goal details:
   - Goal name
   - Target amount
   - Current amount
   - Deadline (optional)
3. View progress bars and status

### Dashboard Insights
The dashboard provides:
- Real-time KPIs (Balance, Income, Expense, Net Worth)
- Income vs Expense chart
- Returns analysis (CAGR)
- Net Worth timeline
- AI-powered insights:
  - Highest spending category
  - Fixed + SIP burden analysis
  - Savings rate analysis
  - Investment performance
  - Goals progress
  - Cashflow risk alerts

## 🔧 Configuration

### API Configuration
Update `CONFIG` object in `app.js`:
```javascript
const CONFIG = {
  API_BASE: "https://sheetdb.io/api/v1/YOUR_API_ID",
  SHEETS: {
    TRANSACTIONS: "",
    INVESTMENTS: "Investments",
    SIP: "SIP",
    FIXED: "FixedExpenses",
    GOALS: "Goals"
  },
  DEFAULT_PIN: "1234",
  MIN_PIN_LENGTH: 4
};
```

### Automation Configuration
Update `CONFIG` in `apps-script.gs`:
```javascript
const CONFIG = {
  SHEETDB_API: "https://sheetdb.io/api/v1/YOUR_API_ID",
  EMAIL_FROM: "your-email@domain.com",
  EMAIL_SUBJECT_PREFIX: "[FinTrack] ",
  ALERT_DAYS_BEFORE: 3
};
```

## 🔐 Security

- PIN-based authentication (stored in localStorage)
- Designed to allow Google OAuth integration later
- All data stored in your Google Sheet (you control access)
- No external API calls for sensitive data

## 📱 PWA Features

- **Installable**: Add to home screen on mobile/desktop
- **Offline Support**: Works without internet (cached data)
- **Fast Loading**: Service Worker caches assets
- **Responsive**: Works on all screen sizes

## 🧮 Returns Engine

### CAGR (Compound Annual Growth Rate)
Calculated for lump-sum investments:
```
CAGR = ((Current Value / Invested Amount) ^ (1 / Years) - 1) × 100
```

### XIRR (Extended Internal Rate of Return)
Calculated for SIPs and irregular cashflows using Newton-Raphson method (Excel-compatible).

## 🤖 AI Insights

Rule-based insights (no external API, fully private):
- Category spending analysis
- Fixed expense burden warnings
- Savings rate evaluation
- Investment performance tracking
- Goals progress monitoring
- Cashflow risk assessment

## 🛠️ Development

### Local Development
```bash
# Serve with HTTPS (required for PWA)
npx serve -s . --ssl-cert cert.pem --ssl-key key.pem

# Or use http-server with localhost
npx http-server -p 8080
```

### Testing
- Test offline functionality by disabling network in DevTools
- Test service worker in Application tab
- Test PWA installation prompt

## 📝 Notes

- **SheetDB Free Tier**: Limited API calls per month
- **Google Apps Script**: Free tier has execution time limits
- **Service Worker**: Requires HTTPS (except localhost)
- **Charts**: Uses Chart.js (loaded from CDN)

## 🔄 Updates

To update the app:
1. Make changes to files
2. Push to GitHub
3. GitHub Pages will auto-deploy
4. Clear browser cache to see updates (or wait for service worker update)

## 📄 License

This project is for personal use. Modify as needed.

## 🆘 Troubleshooting

### Service Worker Not Registering
- Ensure HTTPS (or localhost)
- Check browser console for errors
- Clear cache and reload

### API Errors
- Verify SheetDB API endpoint
- Check API quota/limits
- Verify Google Sheet permissions

### Automation Not Working
- Check Google Apps Script triggers
- Verify script authorization
- Check execution logs in Apps Script

### Charts Not Displaying
- Check internet connection (Chart.js from CDN)
- Verify Chart.js loaded in console
- Check for JavaScript errors

## 🎉 Features Roadmap

Future enhancements:
- [ ] Google OAuth integration
- [ ] Export to CSV/Excel
- [ ] Recurring transaction templates
- [ ] Budget planning
- [ ] Multi-currency support
- [ ] Dark mode
- [ ] Data backup/restore

---

**Built with ❤️ for personal finance management**
