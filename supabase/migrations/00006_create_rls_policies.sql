-- firms
CREATE POLICY "own_firms_select" ON firms FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "own_firms_insert" ON firms FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "own_firms_update" ON firms FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "own_firms_delete" ON firms FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- contacts
CREATE POLICY "own_contacts_select" ON contacts FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "own_contacts_insert" ON contacts FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "own_contacts_update" ON contacts FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "own_contacts_delete" ON contacts FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- scrape_jobs
CREATE POLICY "own_jobs_select" ON scrape_jobs FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);
CREATE POLICY "own_jobs_insert" ON scrape_jobs FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);
CREATE POLICY "own_jobs_update" ON scrape_jobs FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = user_id);

-- api_cache: service role only
CREATE POLICY "service_role_cache" ON api_cache FOR ALL TO service_role
  USING (true);
