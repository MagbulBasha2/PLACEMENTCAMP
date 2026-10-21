CREATE TABLE public.daily_challenge_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  challenge_id uuid NOT NULL REFERENCES public.daily_challenges(id) ON DELETE CASCADE,
  question_id uuid REFERENCES public.aptitude_questions(id) ON DELETE SET NULL,
  selected_index integer NOT NULL,
  is_correct boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, challenge_id)
);

CREATE INDEX idx_daily_attempts_user ON public.daily_challenge_attempts (user_id, created_at DESC);
CREATE INDEX idx_daily_attempts_challenge ON public.daily_challenge_attempts (challenge_id);

GRANT SELECT ON public.daily_challenge_attempts TO authenticated;
GRANT ALL ON public.daily_challenge_attempts TO service_role;

ALTER TABLE public.daily_challenge_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own daily attempts" ON public.daily_challenge_attempts
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));