import type { MovementKind } from "@/lib/types";

export type ImportDecision =
  | "import"
  | "duplicate"
  | "skip_refund"
  | "skip_payment"
  | "skip_zero";

export type PreparedImportLine = {
  fitId: string;
  occurredOn: string;
  amountCents: number;
  signedCents: number;
  description: string;
  movementKind: MovementKind;
  categoryId: string | null;
  categoryName: string | null;
  decision: ImportDecision;
  reason: string | null;
};
