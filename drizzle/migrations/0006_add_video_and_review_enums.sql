CREATE TYPE public.video_resource_type AS ENUM ('concept', 'approach', 'dry_run', 'solution', 'revision');
CREATE TYPE public.video_entity AS ENUM ('topic', 'problem');
ALTER TYPE public.content_status ADD VALUE IF NOT EXISTS 'pending_review';
ALTER TYPE public.submission_status ADD VALUE IF NOT EXISTS 'archived';