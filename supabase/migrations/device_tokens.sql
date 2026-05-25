-- ============================================================
-- device_tokens table — stores FCM tokens for push notifications
-- Run this once in your Supabase SQL editor
-- ============================================================

create table if not exists device_tokens (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  token         text not null,
  platform      text default 'android',   -- 'android' | 'ios'
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now(),
  unique (user_id, token)                 -- prevent duplicate token rows
);

-- Fast lookup by user_id when sending notifications
create index if not exists idx_device_tokens_user_id on device_tokens(user_id);

-- RLS: users can only see/manage their own tokens
alter table device_tokens enable row level security;

create policy "Users manage own tokens" on device_tokens
  for all using (auth.uid() = user_id);

-- Service role (used by API routes) bypasses RLS automatically

-- ============================================================
-- Optional: auto-update updated_at on upsert
-- ============================================================
create or replace function update_device_tokens_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_device_tokens_updated_at on device_tokens;
create trigger trg_device_tokens_updated_at
  before update on device_tokens
  for each row execute function update_device_tokens_updated_at();
