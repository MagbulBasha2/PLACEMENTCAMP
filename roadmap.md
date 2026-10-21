# PlacementCamp — build roadmap

Name: **PlacementCamp** (not PlacementHub) — applies to landing copy, titles, metadata.

## Phase 1 — Backend
- [ ] Database schema: profiles, user_roles, roadmaps, modules, topics, problems, student_problem_progress, aptitude_topics, aptitude_questions, aptitude_attempts, daily_challenges, interview_experiences, bookmarks, notifications, admin_audit_logs, contact_messages
- [ ] RLS + GRANTs on every table, has_role() security definer
- [ ] Storage buckets: avatars, resumes
- [ ] Email auth enabled + Google sign-in

## Phase 2 — Design system + public site
- [ ] Indigo/slate/purple design tokens
- [ ] Landing page (hero, features, FAQ, contact form)
- [ ] Auth pages: sign up, login, forgot/reset password

## Phase 3 — Student app
- [ ] Dashboard with real progress
- [ ] Roadmap + problem tracking
- [ ] Aptitude practice (timed quiz, review, history, analytics)
- [ ] Daily challenge
- [ ] Interview experiences (browse, filter, submit)
- [ ] Bookmarks, profile editing, avatar/resume upload

## Phase 4 — Admin
- [ ] Admin layout + role guard
- [ ] Content CRUD (modules, topics, problems, aptitude, daily challenge)
- [ ] Experience moderation
- [ ] Analytics from real data
- [ ] Audit log viewer

## Phase 5 — Quality
- [ ] Rate limiting on auth + contact
- [ ] Browser test of student + admin flows
- [ ] Fix build/runtime errors
- [ ] Custom domain prep; publish only after user review
