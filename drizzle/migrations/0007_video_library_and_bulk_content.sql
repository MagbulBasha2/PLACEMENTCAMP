-- Video resources attached to topics or problems
CREATE TABLE public.video_resources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type public.video_entity NOT NULL,
  entity_id uuid NOT NULL,
  tutor_name text NOT NULL,
  channel text,
  video_id text NOT NULL,
  video_url text NOT NULL,
  title text NOT NULL,
  language text NOT NULL DEFAULT 'English',
  duration_seconds integer,
  resource_type public.video_resource_type NOT NULL DEFAULT 'concept',
  difficulty public.difficulty_level,
  priority integer NOT NULL DEFAULT 0,
  verified boolean NOT NULL DEFAULT false,
  featured boolean NOT NULL DEFAULT false,
  status public.content_status NOT NULL DEFAULT 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, video_id)
);
CREATE INDEX idx_video_resources_entity ON public.video_resources (entity_type, entity_id, priority);
CREATE INDEX idx_video_resources_video ON public.video_resources (video_id);
CREATE TRIGGER trg_video_resources_updated BEFORE UPDATE ON public.video_resources
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

GRANT SELECT ON public.video_resources TO authenticated;
GRANT ALL ON public.video_resources TO service_role;
ALTER TABLE public.video_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "published videos readable" ON public.video_resources
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins manage videos" ON public.video_resources
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Private per-student watch progress
CREATE TABLE public.video_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  video_resource_id uuid NOT NULL REFERENCES public.video_resources(id) ON DELETE CASCADE,
  entity_type public.video_entity NOT NULL,
  entity_id uuid NOT NULL,
  position_seconds integer NOT NULL DEFAULT 0,
  duration_seconds integer,
  completed boolean NOT NULL DEFAULT false,
  last_watched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, video_resource_id)
);
CREATE INDEX idx_video_progress_user ON public.video_progress (user_id, last_watched_at DESC);
CREATE INDEX idx_video_progress_entity ON public.video_progress (user_id, entity_type, entity_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.video_progress TO authenticated;
GRANT ALL ON public.video_progress TO service_role;
ALTER TABLE public.video_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own video progress" ON public.video_progress
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Practice links beside the player
ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS leetcode_url text;
ALTER TABLE public.problems ADD COLUMN IF NOT EXISTS gfg_url text;

-- Aptitude import metadata
ALTER TABLE public.aptitude_questions ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];
ALTER TABLE public.aptitude_questions ADD COLUMN IF NOT EXISTS time_limit_seconds integer;
ALTER TABLE public.aptitude_questions ADD COLUMN IF NOT EXISTS source text;

-- Timed aptitude tests assembled from imported questions
CREATE TABLE public.aptitude_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  duration_seconds integer NOT NULL DEFAULT 1800,
  status public.content_status NOT NULL DEFAULT 'draft',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_apt_tests_updated BEFORE UPDATE ON public.aptitude_tests
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
GRANT SELECT ON public.aptitude_tests TO authenticated;
GRANT ALL ON public.aptitude_tests TO service_role;
ALTER TABLE public.aptitude_tests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "published tests readable" ON public.aptitude_tests
  FOR SELECT TO authenticated
  USING (status = 'published' OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins manage tests" ON public.aptitude_tests
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.aptitude_test_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  test_id uuid NOT NULL REFERENCES public.aptitude_tests(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.aptitude_questions(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  UNIQUE (test_id, question_id)
);
CREATE INDEX idx_apt_test_questions_test ON public.aptitude_test_questions (test_id, order_index);
GRANT SELECT ON public.aptitude_test_questions TO authenticated;
GRANT ALL ON public.aptitude_test_questions TO service_role;
ALTER TABLE public.aptitude_test_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "test questions readable" ON public.aptitude_test_questions
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.aptitude_tests t
    WHERE t.id = test_id AND (t.status = 'published' OR public.has_role(auth.uid(), 'admin'::public.app_role))
  ));
CREATE POLICY "admins manage test questions" ON public.aptitude_test_questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

ALTER TABLE public.aptitude_attempts ADD COLUMN IF NOT EXISTS test_id uuid REFERENCES public.aptitude_tests(id) ON DELETE SET NULL;

-- Interview experience enrichment
ALTER TABLE public.interview_experiences ADD COLUMN IF NOT EXISTS interview_date date;
ALTER TABLE public.interview_experiences ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;
ALTER TABLE public.interview_experiences ADD COLUMN IF NOT EXISTS featured boolean NOT NULL DEFAULT false;
ALTER TABLE public.interview_experiences ADD COLUMN IF NOT EXISTS moderation_note text;

CREATE POLICY "admins create experiences" ON public.interview_experiences
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE public.experience_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  experience_id uuid NOT NULL REFERENCES public.interview_experiences(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL,
  handled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (experience_id, reporter_id)
);
CREATE INDEX idx_experience_reports_exp ON public.experience_reports (experience_id);
GRANT SELECT, INSERT ON public.experience_reports TO authenticated;
GRANT ALL ON public.experience_reports TO service_role;
ALTER TABLE public.experience_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report own flags readable" ON public.experience_reports
  FOR SELECT TO authenticated
  USING (auth.uid() = reporter_id OR public.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "students can report" ON public.experience_reports
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "admins update reports" ON public.experience_reports
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));