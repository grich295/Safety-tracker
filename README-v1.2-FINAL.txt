Safety Tracker v1.2 Final

This replaces the earlier v1.2 candidate before installation.

Adds:
- Secure Admin user invitations; invited users must choose their own password.
- Database-level rule: only the authenticated trainee can submit their own sign-off.
- Instructor-led attendance is confirmed per person with the actual training date.
- Selected trainees can be marked Attended or Absent; unselected people remain outstanding for later.
- Fresh instructor confirmation is required again for recurring training.
- Self-training / Instructor-led selection for each document/training item.
- Admin/Manager creator exception for their own assignment, with mandatory audit reason.
- Compliance dashboard and employee records.
- Bulk assignment and full backup.
- SDS/MSDS document type.
- Document links: SDS/MSDS -> COSHH, COSHH -> SSW, RA -> SSW, plus general related-document links.
- Staff can open linked current documents from assigned document cards.
- A new SDS/MSDS version automatically flags linked COSHH assessments for review.
- A new COSHH version automatically flags linked SSWs for review.
- Report downloads are PDF rather than editable Excel/CSV.
- Full Evidence PDF includes compliance, sign-offs, attendance/instructor events, review dates and document links.
- Individual employee record downloads as PDF.

INSTALL ON LAPTOP:
1. In the existing Safety Tracker Supabase project, open SQL Editor -> New query.
2. Paste the entire safety_tracker_v1_2_final_laptop_migration.sql and click Run once.
3. Deploy/update Edge Function invite-user using supabase/functions/invite-user/index.ts (plain text copy also included).
4. Upload to the Safety-tracker GitHub repo:
   index.html
   app-v12final.js
   styles-v12final.css
   sw.js
5. Commit and open the site with ?v=12final.

NOTE ABOUT PDF EVIDENCE:
PDF makes casual editing harder than spreadsheets and is a better evidence-copy format, but an ordinary PDF is not cryptographically tamper-proof.
