# Energy Tracker v0.8.5

Solar import correction patch.

- Locks Monthly Power Station Chart daily rows to the inferred report month/year.
- Deduplicates dates before save.
- Shows new / updated / unchanged / failed counts after import.
- Reloads Solar data from Supabase immediately after import.
- Clears the selected solar file after a successful import.
- Original uploaded solar files are not stored.
