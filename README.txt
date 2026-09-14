Safety Tracker v2.10.11 CLEAN
Build ID: v21011-document-control-20260914

Changes in this build:
- Approved documents can now be edited for controlled metadata: title/reference, training method, refresher frequency, current review date and training audience. PDF content changes still use Create New Version.
- Document Manager/Register now exposes direct Links and Edit controls. Document links remain pairwise/direct; one link does not create links between the related documents.
- Document Creation ON/OFF control for Manager/Admin. OFF blocks new document creation but keeps existing documents, approvals, Register, links and Training working.
- Safety document creator PDF header uses a neutral YOUR COMPANY LOGO HERE placeholder; no Shield logo/branding is added.
- General Maintenance H&S disclaimer added, plus contractor sign-in, creator and asbestos contextual notices.
- Contractor digital signatures remain in place. Document approvals continue to use tick confirmation rather than a drawn signature.
- Pending approval queue remains at the top of Documents.

Database:
- No new SQL migration is included. The Document Creation toggle uses the existing safety_tracker_settings table.
