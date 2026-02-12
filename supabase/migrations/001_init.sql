-- ============================================================
-- Redeem Points System — Full Migration
-- ============================================================

-- 0) Helper: updated_at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 0b) Helper: normalize Thai phone  0xxxxxxxxx -> 66xxxxxxxxx
CREATE OR REPLACE FUNCTION normalize_th_phone(raw text)
RETURNS text AS $$
DECLARE
  digits text;
BEGIN
  digits := regexp_replace(raw, '[^0-9]', '', 'g');
  IF left(digits, 1) = '0' THEN
    digits := '66' || substring(digits from 2);
  END IF;
  RETURN digits;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================
-- 1) organizations
-- ============================================================
CREATE TABLE organizations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 2) profiles (linked to auth.users)
-- ============================================================
CREATE TABLE profiles (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id       uuid NOT NULL REFERENCES organizations(id),
  role         text NOT NULL CHECK (role IN ('ADMIN','STAFF')),
  display_name text NOT NULL DEFAULT '',
  created_at   timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3) customers
-- ============================================================
CREATE TABLE customers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id),
  customer_code    text NOT NULL,
  full_name        text NOT NULL,
  phone            text NOT NULL,
  phone_normalized text NOT NULL,
  birth_date       date NOT NULL,
  email            text,
  notes            text,
  line_id          text,
  line_linked_at   timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_customers_org_code ON customers(org_id, customer_code);
CREATE UNIQUE INDEX idx_customers_org_phone_bd ON customers(org_id, phone_normalized, birth_date)
  WHERE phone_normalized IS NOT NULL AND birth_date IS NOT NULL;
CREATE UNIQUE INDEX idx_customers_org_line ON customers(org_id, line_id)
  WHERE line_id IS NOT NULL;

CREATE TRIGGER trg_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 4) services
-- ============================================================
CREATE TABLE services (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id     uuid NOT NULL REFERENCES organizations(id),
  name       text NOT NULL,
  category   text NOT NULL CHECK (category IN ('HOTEL','RESTAURANT','CAFE')),
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- 5) earning_rules (versioned)
-- ============================================================
CREATE TABLE earning_rules (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  service_id   uuid NOT NULL REFERENCES services(id),
  spend_amount numeric NOT NULL CHECK (spend_amount > 0),
  earn_points  int NOT NULL CHECK (earn_points >= 0),
  rounding     text NOT NULL DEFAULT 'FLOOR' CHECK (rounding IN ('FLOOR','ROUND','CEIL')),
  min_spend    numeric,
  valid_from   date NOT NULL,
  valid_to     date,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_earning_rules_lookup ON earning_rules(org_id, service_id, valid_from);

-- ============================================================
-- 6) point_transactions (snapshot)
-- ============================================================
CREATE TABLE point_transactions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        uuid NOT NULL REFERENCES organizations(id),
  customer_id   uuid NOT NULL REFERENCES customers(id),
  service_id    uuid NOT NULL REFERENCES services(id),
  tx_datetime   timestamptz NOT NULL,
  spend_amount  numeric NOT NULL CHECK (spend_amount >= 0),
  rule_id       uuid NOT NULL REFERENCES earning_rules(id),
  points_earned int NOT NULL CHECK (points_earned >= 0),
  expires_at    timestamptz NOT NULL,
  reference_no  text,
  note          text,
  created_by    uuid NOT NULL REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_point_transactions_customer ON point_transactions(customer_id, tx_datetime DESC);

-- ============================================================
-- 7) point_ledger (audit)
-- ============================================================
CREATE TABLE point_ledger (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id       uuid NOT NULL REFERENCES organizations(id),
  customer_id  uuid NOT NULL REFERENCES customers(id),
  service_id   uuid REFERENCES services(id),
  source_type  text NOT NULL CHECK (source_type IN ('EARN','REDEEM','EXPIRE','ADJUST','REVERSAL')),
  source_id    uuid,
  points_delta int NOT NULL,
  occurs_at    timestamptz NOT NULL,
  expires_at   timestamptz,
  meta         jsonb DEFAULT '{}',
  created_by   uuid NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_point_ledger_customer ON point_ledger(customer_id, occurs_at DESC);
CREATE INDEX idx_point_ledger_earn_lots ON point_ledger(customer_id, expires_at)
  WHERE points_delta > 0 AND source_type IN ('EARN','ADJUST') AND expires_at IS NOT NULL;

-- ============================================================
-- 8) redeems
-- ============================================================
CREATE TABLE redeems (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id),
  customer_id     uuid NOT NULL REFERENCES customers(id),
  redeem_datetime timestamptz NOT NULL,
  points_redeemed int NOT NULL CHECK (points_redeemed > 0),
  reward_name     text,
  note            text,
  created_by      uuid NOT NULL REFERENCES auth.users(id),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 9) redeem_allocations (FIFO mapping)
-- ============================================================
CREATE TABLE redeem_allocations (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id         uuid NOT NULL REFERENCES organizations(id),
  redeem_id      uuid NOT NULL REFERENCES redeems(id),
  ledger_earn_id uuid NOT NULL REFERENCES point_ledger(id),
  points_used    int NOT NULL CHECK (points_used > 0),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_redeem_alloc_earn ON redeem_allocations(ledger_earn_id);

-- ============================================================
-- 10) line_link_attempts (security log)
-- ============================================================
CREATE TABLE line_link_attempts (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           uuid NOT NULL REFERENCES organizations(id),
  line_id          text NOT NULL,
  phone_normalized text NOT NULL,
  birth_date       date NOT NULL,
  success          boolean NOT NULL DEFAULT false,
  reason           text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- VIEW: v_earn_remaining  (Canonical remaining points per lot)
-- ============================================================
CREATE OR REPLACE VIEW v_earn_remaining AS
SELECT
  pl.id            AS ledger_id,
  pl.org_id,
  pl.customer_id,
  pl.service_id,
  pl.points_delta  AS earned,
  pl.expires_at,
  pl.occurs_at,
  COALESCE(SUM(ra.points_used), 0) AS used,
  pl.points_delta - COALESCE(SUM(ra.points_used), 0) AS remaining
FROM point_ledger pl
LEFT JOIN redeem_allocations ra ON ra.ledger_earn_id = pl.id
WHERE pl.points_delta > 0
  AND pl.source_type IN ('EARN','ADJUST')
  AND pl.expires_at IS NOT NULL
GROUP BY pl.id, pl.org_id, pl.customer_id, pl.service_id,
         pl.points_delta, pl.expires_at, pl.occurs_at;

-- ============================================================
-- RPC: rpc_link_line_to_customer
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_link_line_to_customer(
  p_org_id     uuid,
  p_line_id    text,
  p_phone      text,
  p_birth_date date
)
RETURNS jsonb AS $$
DECLARE
  v_phone_norm text;
  v_customer   customers%ROWTYPE;
  v_result     jsonb;
BEGIN
  v_phone_norm := normalize_th_phone(p_phone);

  SELECT * INTO v_customer
  FROM customers
  WHERE org_id = p_org_id
    AND phone_normalized = v_phone_norm
    AND birth_date = p_birth_date;

  IF v_customer.id IS NULL THEN
    INSERT INTO line_link_attempts (org_id, line_id, phone_normalized, birth_date, success, reason)
    VALUES (p_org_id, p_line_id, v_phone_norm, p_birth_date, false, 'CUSTOMER_NOT_FOUND');
    RETURN jsonb_build_object('success', false, 'error', 'CUSTOMER_NOT_FOUND');
  END IF;

  IF v_customer.line_id IS NOT NULL AND v_customer.line_id <> p_line_id THEN
    INSERT INTO line_link_attempts (org_id, line_id, phone_normalized, birth_date, success, reason)
    VALUES (p_org_id, p_line_id, v_phone_norm, p_birth_date, false, 'LINE_ID_MISMATCH');
    RETURN jsonb_build_object('success', false, 'error', 'LINE_ID_MISMATCH');
  END IF;

  IF v_customer.line_id IS NULL THEN
    UPDATE customers
    SET line_id = p_line_id, line_linked_at = now()
    WHERE id = v_customer.id;

    INSERT INTO line_link_attempts (org_id, line_id, phone_normalized, birth_date, success, reason)
    VALUES (p_org_id, p_line_id, v_phone_norm, p_birth_date, true, 'LINKED');
  ELSE
    INSERT INTO line_link_attempts (org_id, line_id, phone_normalized, birth_date, success, reason)
    VALUES (p_org_id, p_line_id, v_phone_norm, p_birth_date, true, 'ALREADY_LINKED');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'customer_id', v_customer.id,
    'full_name', v_customer.full_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: rpc_get_customer_portal_summary
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_get_customer_portal_summary(
  p_org_id      uuid,
  p_customer_id uuid
)
RETURNS jsonb AS $$
DECLARE
  v_available    bigint;
  v_expiring_3m  bigint;
BEGIN
  SELECT COALESCE(SUM(remaining), 0) INTO v_available
  FROM v_earn_remaining
  WHERE org_id = p_org_id
    AND customer_id = p_customer_id
    AND remaining > 0
    AND expires_at > now();

  SELECT COALESCE(SUM(remaining), 0) INTO v_expiring_3m
  FROM v_earn_remaining
  WHERE org_id = p_org_id
    AND customer_id = p_customer_id
    AND remaining > 0
    AND expires_at > now()
    AND expires_at <= now() + interval '3 months';

  RETURN jsonb_build_object(
    'available_points', v_available,
    'expiring_3m_points', v_expiring_3m
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: rpc_create_transaction_earn (atomic earn)
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_create_transaction_earn(
  p_org_id       uuid,
  p_customer_id  uuid,
  p_service_id   uuid,
  p_spend_amount numeric,
  p_tx_datetime  timestamptz,
  p_reference_no text DEFAULT NULL,
  p_note         text DEFAULT NULL,
  p_created_by   uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_rule         earning_rules%ROWTYPE;
  v_raw          numeric;
  v_points       int;
  v_expires      timestamptz;
  v_tx_id        uuid;
  v_ledger_id    uuid;
  v_tx_date      date;
BEGIN
  v_tx_date := (p_tx_datetime AT TIME ZONE 'UTC')::date;

  SELECT * INTO v_rule
  FROM earning_rules
  WHERE org_id = p_org_id
    AND service_id = p_service_id
    AND valid_from <= v_tx_date
    AND (valid_to IS NULL OR v_tx_date <= valid_to)
  ORDER BY valid_from DESC
  LIMIT 1;

  IF v_rule.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'NO_ACTIVE_RULE');
  END IF;

  IF v_rule.min_spend IS NOT NULL AND p_spend_amount < v_rule.min_spend THEN
    RETURN jsonb_build_object('success', false, 'error', 'BELOW_MIN_SPEND');
  END IF;

  v_raw := (p_spend_amount / v_rule.spend_amount) * v_rule.earn_points;

  IF v_rule.rounding = 'FLOOR' THEN
    v_points := GREATEST(floor(v_raw)::int, 0);
  ELSIF v_rule.rounding = 'ROUND' THEN
    v_points := GREATEST(round(v_raw)::int, 0);
  ELSIF v_rule.rounding = 'CEIL' THEN
    v_points := GREATEST(ceil(v_raw)::int, 0);
  ELSE
    v_points := GREATEST(floor(v_raw)::int, 0);
  END IF;

  v_expires := p_tx_datetime + interval '365 days';

  INSERT INTO point_transactions (org_id, customer_id, service_id, tx_datetime, spend_amount,
    rule_id, points_earned, expires_at, reference_no, note, created_by)
  VALUES (p_org_id, p_customer_id, p_service_id, p_tx_datetime, p_spend_amount,
    v_rule.id, v_points, v_expires, p_reference_no, p_note, p_created_by)
  RETURNING id INTO v_tx_id;

  INSERT INTO point_ledger (org_id, customer_id, service_id, source_type, source_id,
    points_delta, occurs_at, expires_at, meta, created_by)
  VALUES (p_org_id, p_customer_id, p_service_id, 'EARN', v_tx_id,
    v_points, p_tx_datetime, v_expires,
    jsonb_build_object('spend_amount', p_spend_amount, 'rule_id', v_rule.id),
    p_created_by)
  RETURNING id INTO v_ledger_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_tx_id,
    'ledger_id', v_ledger_id,
    'points_earned', v_points,
    'expires_at', v_expires,
    'rule_spend', v_rule.spend_amount,
    'rule_earn', v_rule.earn_points
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RPC: rpc_redeem_points (atomic FIFO redeem)
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_redeem_points(
  p_org_id          uuid,
  p_customer_id     uuid,
  p_points_to_redeem int,
  p_redeem_datetime timestamptz,
  p_reward_name     text DEFAULT NULL,
  p_note            text DEFAULT NULL,
  p_created_by      uuid DEFAULT NULL
)
RETURNS jsonb AS $$
DECLARE
  v_available     bigint;
  v_redeem_id     uuid;
  v_ledger_id     uuid;
  v_remaining_req int;
  v_lot           RECORD;
  v_take          int;
BEGIN
  IF p_points_to_redeem <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'INVALID_POINTS');
  END IF;

  SELECT COALESCE(SUM(remaining), 0) INTO v_available
  FROM v_earn_remaining
  WHERE org_id = p_org_id
    AND customer_id = p_customer_id
    AND remaining > 0
    AND expires_at > now();

  IF v_available < p_points_to_redeem THEN
    RETURN jsonb_build_object('success', false, 'error', 'INSUFFICIENT_POINTS',
      'available', v_available);
  END IF;

  INSERT INTO redeems (org_id, customer_id, redeem_datetime, points_redeemed,
    reward_name, note, created_by)
  VALUES (p_org_id, p_customer_id, p_redeem_datetime, p_points_to_redeem,
    p_reward_name, p_note, p_created_by)
  RETURNING id INTO v_redeem_id;

  INSERT INTO point_ledger (org_id, customer_id, source_type, source_id,
    points_delta, occurs_at, meta, created_by)
  VALUES (p_org_id, p_customer_id, 'REDEEM', v_redeem_id,
    -p_points_to_redeem, p_redeem_datetime,
    jsonb_build_object('reward_name', p_reward_name),
    p_created_by)
  RETURNING id INTO v_ledger_id;

  v_remaining_req := p_points_to_redeem;

  FOR v_lot IN
    SELECT ledger_id, remaining
    FROM v_earn_remaining
    WHERE org_id = p_org_id
      AND customer_id = p_customer_id
      AND remaining > 0
      AND expires_at > now()
    ORDER BY expires_at ASC, occurs_at ASC
  LOOP
    EXIT WHEN v_remaining_req <= 0;

    v_take := LEAST(v_lot.remaining, v_remaining_req);

    INSERT INTO redeem_allocations (org_id, redeem_id, ledger_earn_id, points_used)
    VALUES (p_org_id, v_redeem_id, v_lot.ledger_id, v_take);

    v_remaining_req := v_remaining_req - v_take;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'redeem_id', v_redeem_id,
    'points_redeemed', p_points_to_redeem
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================
-- RLS Policies
-- ============================================================

-- Helper function: get user's org_id
CREATE OR REPLACE FUNCTION get_my_org_id()
RETURNS uuid AS $$
  SELECT org_id FROM profiles WHERE user_id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: check if user is staff (ADMIN or STAFF)
CREATE OR REPLACE FUNCTION is_staff()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role IN ('ADMIN','STAFF')
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Helper function: check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE user_id = auth.uid() AND role = 'ADMIN'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE earning_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE redeems ENABLE ROW LEVEL SECURITY;
ALTER TABLE redeem_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_link_attempts ENABLE ROW LEVEL SECURITY;

-- organizations
CREATE POLICY "org_select" ON organizations FOR SELECT TO authenticated
  USING (id = get_my_org_id());

-- profiles
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (org_id = get_my_org_id());
CREATE POLICY "profiles_own" ON profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- customers
CREATE POLICY "customers_select" ON customers FOR SELECT TO authenticated
  USING (is_staff() AND org_id = get_my_org_id());
CREATE POLICY "customers_insert" ON customers FOR INSERT TO authenticated
  WITH CHECK (is_staff() AND org_id = get_my_org_id());
CREATE POLICY "customers_update" ON customers FOR UPDATE TO authenticated
  USING (is_staff() AND org_id = get_my_org_id());

-- services
CREATE POLICY "services_select" ON services FOR SELECT TO authenticated
  USING (is_staff() AND org_id = get_my_org_id());
CREATE POLICY "services_insert" ON services FOR INSERT TO authenticated
  WITH CHECK (is_staff() AND org_id = get_my_org_id());
CREATE POLICY "services_update" ON services FOR UPDATE TO authenticated
  USING (is_staff() AND org_id = get_my_org_id());

-- earning_rules
CREATE POLICY "rules_select" ON earning_rules FOR SELECT TO authenticated
  USING (is_staff() AND org_id = get_my_org_id());
CREATE POLICY "rules_insert" ON earning_rules FOR INSERT TO authenticated
  WITH CHECK (is_staff() AND org_id = get_my_org_id());

-- point_transactions
CREATE POLICY "pt_select" ON point_transactions FOR SELECT TO authenticated
  USING (is_staff() AND org_id = get_my_org_id());
CREATE POLICY "pt_insert" ON point_transactions FOR INSERT TO authenticated
  WITH CHECK (is_staff() AND org_id = get_my_org_id());

-- point_ledger
CREATE POLICY "pl_select" ON point_ledger FOR SELECT TO authenticated
  USING (is_staff() AND org_id = get_my_org_id());
CREATE POLICY "pl_insert" ON point_ledger FOR INSERT TO authenticated
  WITH CHECK (is_staff() AND org_id = get_my_org_id());

-- redeems
CREATE POLICY "redeems_select" ON redeems FOR SELECT TO authenticated
  USING (is_staff() AND org_id = get_my_org_id());
CREATE POLICY "redeems_insert" ON redeems FOR INSERT TO authenticated
  WITH CHECK (is_staff() AND org_id = get_my_org_id());

-- redeem_allocations
CREATE POLICY "ra_select" ON redeem_allocations FOR SELECT TO authenticated
  USING (is_staff() AND org_id = get_my_org_id());
CREATE POLICY "ra_insert" ON redeem_allocations FOR INSERT TO authenticated
  WITH CHECK (is_staff() AND org_id = get_my_org_id());

-- line_link_attempts (ADMIN only)
CREATE POLICY "lla_select" ON line_link_attempts FOR SELECT TO authenticated
  USING (is_admin() AND org_id = get_my_org_id());
