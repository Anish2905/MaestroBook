import { z } from 'zod';

export const partySchema = z.object({
  party_name: z.string().min(1, "Party name is required"),
  party_type: z.enum(["Vendor", "Customer", "Both"]),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  opening_balance: z.number().int().default(0), // stored in paise
  updated_at: z.string().optional() // required for PUT
});

export const invoiceSchema = z.object({
  party_id: z.number().int().positive("Party ID is required"),
  invoice_number: z.string().optional().nullable(),
  invoice_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  invoice_type: z.enum(["Purchase", "Sale"]),
  amount: z.number().int().positive("Amount must be positive"),
  remarks: z.string().nullable().optional(),
  updated_at: z.string().optional() // required for PUT
});

export const transactionSchema = z.object({
  txn_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  txn_type: z.enum(["Payment Made", "Receipt"]),
  category: z.string().min(1, "Category is required"),
  party_id: z.number().int().positive().nullable().optional(),
  linked_invoice_id: z.number().int().positive().nullable().optional(),
  amount: z.number().int().positive("Amount must be positive"),
  remarks: z.string().nullable().optional(),
  updated_at: z.string().optional() // required for PUT
});

export const overrideSchema = z.object({
  party_id: z.number().int().positive("Party ID is required"),
  override_amount: z.number().int(),
  reason: z.string().min(1, "Reason is required")
});

export function validateRequest(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      return res.status(400).json({ error: error.errors.map(e => e.message).join(", ") });
    }
  };
}
