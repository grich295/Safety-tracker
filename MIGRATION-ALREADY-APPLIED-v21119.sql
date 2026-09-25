-- Safety Tracker v2.11.19 migration record
-- BOTH required v2.11.19 migrations have already been applied directly to Supabase.
-- No SQL action is required.

-- Generic document folders:
-- document_folders_v21119
-- document_read_audiences_v21119
-- generic document columns on documents/document_versions
-- my_document_reads_v21119()
-- updated user_can_access_document_v237()

-- Department Leads:
-- department_leads_v21119
-- set_user_department_leads_v21119(uuid, uuid[])
--
-- Department Lead is deliberately separate from app Role/access.
-- The person must belong to every department they are marked as leading.
