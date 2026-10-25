import { vi } from "vitest";

// Підставний Supabase для форми закупівлі й «Мої заявки»: ланцюжки запитів, які викликають
// src/lib/purchases/options.ts, src/app/purchases/actions.ts і src/app/purchases/page.tsx.
export const P1 = "00000000-0000-4000-8000-000000000001";
export const P2 = "00000000-0000-4000-8000-000000000002";
export const ADMIN = "00000000-0000-4000-8000-0000000000a1";
export const PRIMARY = { id: "00000000-0000-4000-8000-0000000000d1", name: "Primary School" };
export const OFFICE = { id: "00000000-0000-4000-8000-0000000000d2", name: "Office" };
export const HIGH = { id: "00000000-0000-4000-8000-0000000000d3", name: "High School" };

export type FakeDbState = {
  departments?: { id: string; name: string }[];
  members?: { profile_id: string; department_id: string }[];
  selfPurchase?: boolean;
  purchases?: { id: string; author_id: string; department_id: string; purchase_type: string; status: string; created_at: string }[];
  rpcError?: { message: string } | null;
};

export function fakeDb(state: FakeDbState = {}) {
  const rpc = vi.fn().mockResolvedValue({ data: "new-purchase-id", error: state.rpcError ?? null });
  const purchasesQuery = { author: undefined as string | undefined };
  const ok = <T>(data: T) => Promise.resolve({ data, error: null });

  const client = {
    rpc,
    from: vi.fn((table: string) => {
      switch (table) {
        case "departments":
          return { select: () => ok(state.departments ?? []) };
        case "department_members":
          return {
            select: () => ({
              eq: (_column: string, profileId: string) =>
                ok((state.members ?? []).filter((m) => m.profile_id === profileId)),
            }),
          };
        case "profiles":
          return {
            select: () => ({
              eq: () => ({
                single: () =>
                  ok({
                    can_card_expense: false,
                    can_check_request: false,
                    can_vendor_invoice: false,
                    can_self_purchase: state.selfPurchase ?? false,
                  }),
              }),
            }),
          };
        case "purchases":
          return {
            select: () => ({
              eq: (_column: string, authorId: string) => {
                purchasesQuery.author = authorId;
                return { order: () => ok((state.purchases ?? []).filter((p) => p.author_id === authorId)) };
              },
            }),
          };
        default:
          throw new Error(`unexpected table ${table}`);
      }
    }),
  };
  return { client, rpc, purchasesQuery };
}

export function viewer(id: string, role: "requester" | "approver" | "admin" = "requester") {
  return { id, email: `${id.slice(-2)}@example.test`, fullName: null, role, isActive: true };
}

export function form(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([k, v]) => data.set(k, v));
  return data;
}

export const ONE_LINE = JSON.stringify([{ name: "Paper A4", purpose: "Printing", quantity: "3", unitPrice: "20.00" }]);
