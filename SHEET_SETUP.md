# Google Sheets Setup for FinTrack

## Required: Add ID Column

SheetDB requires an `id` column for deletion to work properly. You need to add this column to **ALL** your sheets.

### Steps to Add ID Column:

1. **Open your Google Sheet**
2. **For each sheet tab**, add a new column **A** (insert column at the beginning)
3. **Name the column header**: `id` (lowercase)
4. **For existing rows**: Leave the cells empty (SheetDB will auto-generate IDs)
5. **For new rows**: Leave empty - SheetDB will auto-fill

### Updated Sheet Structure:

#### Transactions Sheet:
```
id | Date | Type | Category | Description | Amount | Source
```

#### investments Sheet:
```
id | Date | Asset | InvestedAmount | CurrentValue | Notes
```

#### SIP Sheet:
```
id | StartDate | Asset | MonthlyAmount | Day | DurationMonths | Active | LastPostedMonth
```

#### FixedExpenses Sheet:
```
id | Name | Category | Amount | Frequency | DueDay | AutoDebit | Active | LastPostedMonth
```

#### Goals Sheet:
```
id | Goal | TargetAmount | CurrentAmount | Deadline | Priority | Status
```

### Important Notes:

- The `id` column must be the **first column** (Column A)
- Column header must be exactly `id` (lowercase)
- Leave cells empty - SheetDB will auto-generate unique IDs
- After adding the column, SheetDB will automatically populate IDs for existing rows
- You may need to refresh/reconnect SheetDB after adding the column

### Alternative (If ID column doesn't work):

If adding the `id` column doesn't work, you can try:
1. Add a `row_id` column instead (though `id` is preferred)
2. Or contact SheetDB support to enable ID auto-generation

---

**After adding the ID column, deletion should work properly!**
