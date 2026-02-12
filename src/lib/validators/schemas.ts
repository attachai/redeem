import { z } from "zod";

export const customerSchema = z.object({
  customer_code: z.string().min(1, "รหัสลูกค้าต้องไม่ว่าง"),
  full_name: z.string().min(1, "ชื่อต้องไม่ว่าง"),
  phone: z.string().min(9, "เบอร์โทรต้องมีอย่างน้อย 9 หลัก"),
  birth_date: z.string().min(1, "วันเกิดต้องไม่ว่าง"),
  email: z.string().email("อีเมลไม่ถูกต้อง").optional().or(z.literal("")),
  notes: z.string().optional(),
});

export const serviceSchema = z.object({
  name: z.string().min(1, "ชื่อบริการต้องไม่ว่าง"),
  category: z.enum(["HOTEL", "RESTAURANT", "CAFE"], {
    error: "ประเภทไม่ถูกต้อง",
  }),
  is_active: z.boolean().default(true),
});

export const earningRuleSchema = z.object({
  service_id: z.string().uuid("กรุณาเลือกบริการ"),
  spend_amount: z.number().positive("จำนวนเงินต้องมากกว่า 0"),
  earn_points: z.number().int().min(0, "แต้มต้องไม่ติดลบ"),
  rounding: z.enum(["FLOOR", "ROUND", "CEIL"]).default("FLOOR"),
  min_spend: z.number().positive().nullable().optional(),
  valid_from: z.string().min(1, "วันเริ่มต้นต้องไม่ว่าง"),
  valid_to: z.string().optional().or(z.literal("")),
});

export const earnTransactionSchema = z.object({
  customer_id: z.string().uuid("กรุณาเลือกลูกค้า"),
  service_id: z.string().uuid("กรุณาเลือกบริการ"),
  spend_amount: z.number().positive("ยอดใช้จ่ายต้องมากกว่า 0"),
  reference_no: z.string().optional(),
  note: z.string().optional(),
});

export const redeemSchema = z.object({
  customer_id: z.string().uuid("กรุณาเลือกลูกค้า"),
  points_to_redeem: z.number().int().positive("แต้มต้องมากกว่า 0"),
  reward_name: z.string().optional(),
  note: z.string().optional(),
});

export const portalLinkSchema = z.object({
  id_token: z.string().min(1, "id_token required"),
  phone: z.string().min(9, "เบอร์โทรต้องมีอย่างน้อย 9 หลัก"),
  birth_date: z.string().min(1, "วันเกิดต้องไม่ว่าง"),
});
