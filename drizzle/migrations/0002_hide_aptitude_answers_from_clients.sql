-- Students must never read correct_index directly; quizzes are served and graded
-- by server functions using the service role.
DROP POLICY IF EXISTS "published apt questions" ON public.aptitude_questions;