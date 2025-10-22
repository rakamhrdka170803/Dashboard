-- 20251021_create_holiday_swaps.sql
CREATE TABLE IF NOT EXISTS holiday_swaps (
  id BIGSERIAL PRIMARY KEY,
  requester_id BIGINT NOT NULL,
  target_user_id BIGINT NOT NULL,
  off_date TIMESTAMPTZ NOT NULL,
  reason TEXT,
  status VARCHAR(20) NOT NULL,
  approved_at TIMESTAMPTZ NULL,
  created_schedule_id BIGINT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_holiday_swaps_requester ON holiday_swaps(requester_id);
CREATE INDEX IF NOT EXISTS idx_holiday_swaps_target ON holiday_swaps(target_user_id);
CREATE INDEX IF NOT EXISTS idx_holiday_swaps_status ON holiday_swaps(status);
