-- ============================================================
-- RPC: rpc_check_line_uid
-- Check if a LINE UUID is already linked to a customer.
-- If linked, return customer info for auto-login.
-- ============================================================
CREATE OR REPLACE FUNCTION rpc_check_line_uid(
  p_org_id  uuid,
  p_line_id text
)
RETURNS jsonb AS $$
DECLARE
  v_customer customers%ROWTYPE;
BEGIN
  SELECT * INTO v_customer
  FROM customers
  WHERE org_id = p_org_id
    AND line_id = p_line_id;

  IF v_customer.id IS NULL THEN
    RETURN jsonb_build_object('found', false);
  END IF;

  RETURN jsonb_build_object(
    'found', true,
    'customer_id', v_customer.id,
    'full_name', v_customer.full_name,
    'customer_code', v_customer.customer_code
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
