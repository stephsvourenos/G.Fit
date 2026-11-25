# Builds crm-multi.xlsx, the Excel test file for the CRM import tests. All people are fictional.
# Run: python3 make-crm-xlsx.py
import datetime, openpyxl
wb = openpyxl.Workbook()
a = wb.active; a.title = "Pilates"
a.append(["creator_name", "country", "Instagram", "instagram_followers", "full_length_workouts_available", "research_date", "notes"])
a.append(["FICTIONAL Ava Example", "Australia", "@ava.example.fit", 12500, "yes", datetime.date(2026, 11, 20), "=HYPERLINK(\"http://evil.invalid\",\"click\")"])
a.append(["FICTIONAL Ben Sample", "New Zealand", "https://www.instagram.com/ben.sample/", "unknown", "", "2026-11-21", "Plain note, with comma"])
b = wb.create_sheet("Dance & Yoga")
b.append(["Creator Name", "Country", "TikTok", "Total Fit Score", "Primary Category"])
b.append(["FICTIONAL Cleo Test", "Australia", "@cleo.test", 88, "Dance fitness"])
b["D3"] = "=40+2"
b["A3"] = "FICTIONAL Dee Formula"
b["B3"] = "Australia"
wb.save("crm-multi.xlsx")
