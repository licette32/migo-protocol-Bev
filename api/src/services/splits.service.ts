import { SplitInput } from "../types/split.types";
import { getPaymentsBySplit } from "./payment.service";
import { Payment } from "../types/payment.types";
import { sendSettlementPayment } from "./stellar.service";
import { sendWebhook } from "./webhook.service";
import { PaymentIntent } from "../types/payment-intent.types";
import { prisma } from "../lib/prisma";

// Crear split
export async function createSplitService(input: SplitInput) {
    validateSplit(input);

    const split = await prisma.split.create({
        data: {
        totalAmount: input.totalAmount,
        mode: input.mode,
        network: input.settlementAsset.network,
        assetType: input.settlementAsset.type,
        assetCode: input.settlementAsset.code,
        assetIssuer: 'issuer' in input.settlementAsset ? input.settlementAsset.issuer : null,
        webhookUrl: input.webhookUrl ?? null,
        expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
        },
    });

    return toSplit(split);
}

// Obtener split por ID
export async function getSplitByIdService(id: string) {
  const split = await prisma.split.findUnique({ where: { id } });
  if (!split) throw new Error("Split not found");

  if (split.expiresAt && new Date() > split.expiresAt) {
    await prisma.split.update({ where: { id }, data: { status: "CANCELLED" } });
    return toSplit({ ...split, status: "CANCELLED" });
  }

  if (split.status === "SETTLED") return toSplit(split);

  const payments = await prisma.payment.findMany({ where: { splitId: id } });
  const totalPaid = payments.reduce((sum, p) => sum + p.convertedAmount, 0);

  // DEX conversions introduce floating-point imprecision: a payment of 1 XLM
  // may convert to 0.9999997 USDC instead of exactly 1.0. The tolerance window
  // prevents the split from being stuck in PARTIAL when the payer has effectively
  // covered the full amount. 0.0001 is well above JS float noise but below any
  // meaningful underpayment.
  const TOLERANCE = 0.0001;
  let status = "PENDING";
  if (totalPaid >= split.totalAmount - TOLERANCE) status = "READY_FOR_SETTLEMENT";
  else if (totalPaid > 0) status = "PARTIAL";

  await prisma.split.update({ where: { id }, data: { status } });

  return toSplit({ ...split, status });
}

// Payment intent
export async function getPaymentIntent(splitId: string): Promise<PaymentIntent> {
  const split = await getSplitByIdService(splitId);
  const payments = await prisma.payment.findMany({ where: { splitId } });
  const totalPaid = payments.reduce((sum, p) => sum + p.convertedAmount, 0);
  const remainingAmount = split.totalAmount - totalPaid;

  return {
    splitId: split.id,
    amount: split.totalAmount,
    remainingAmount,
    settlementAsset: split.settlementAsset,
    status: split.status as any,
    expiresAt: split.expiresAt,
    memo: `MIGO_SPLIT_${split.id}`,
  };
}

// Release settlement
export async function releaseSettlement(splitId: string) {
  const TOLERANCE = 0.0001;
  const split = await prisma.split.findUnique({ where: { id: splitId } });
  if (!split) throw new Error("Split not found");
  if (split.status === "SETTLED") throw new Error("Split already settled");

  const current = await getSplitByIdService(splitId);
  if (current.status !== "READY_FOR_SETTLEMENT") throw new Error("Split not ready for settlement");

  const payments = await prisma.payment.findMany({ where: { splitId } });
  const totalPaid = payments.reduce((sum, p) => sum + p.convertedAmount, 0);
  if (totalPaid < split.totalAmount - TOLERANCE) throw new Error("Amount below tolerance for settlement");

  const txHash = await sendSettlementPayment(
    split.totalAmount.toString(),
    current.settlementAsset
  );

  const updated = await prisma.split.update({
    where: { id: splitId },
    data: {
      status: "SETTLED",
      releasedAt: new Date(),
      stellarTxHash: txHash,
    },
  });

  if (split.webhookUrl) {
    await sendWebhook(split.webhookUrl, {
      event: "SPLIT_SETTLED",
      splitId: split.id,
      status: "SETTLED",
      totalAmount: split.totalAmount,
    });
  }

  return toSplit(updated);
}

// Cancel
export async function cancelSplitService(splitId: string) {
  const split = await prisma.split.findUnique({ where: { id: splitId } });
  if (!split) throw new Error("Split not found");
  if (split.status === "SETTLED") throw new Error("Cannot cancel a settled split");

  const updated = await prisma.split.update({
    where: { id: splitId },
    data: { status: "CANCELLED" },
  });

  return toSplit(updated);
}

// Participants status (solo FIXED)
export async function getParticipantsStatus(splitId: string) {
  const split = await getSplitByIdService(splitId);
  if (split.mode !== "FIXED") throw new Error("Participants status only applies to FIXED mode");
  return [];
}

// Helper — convierte el modelo de Prisma al tipo Split del dominio
function toSplit(s: any) {
  return {
    id: s.id,
    totalAmount: s.totalAmount,
    mode: s.mode,
    status: s.status,
    settlementAsset: {
      network: s.network,
      type: s.assetType,
      code: s.assetCode,
      issuer: s.assetIssuer ?? undefined,
    },
    participants: [],
    webhookUrl: s.webhookUrl ?? undefined,
    stellarTxHash: s.stellarTxHash ?? undefined,
    createdAt: s.createdAt,
    expiresAt: s.expiresAt ?? undefined,
    releasedAt: s.releasedAt ?? undefined,
  };
}

function validateSplit(input: SplitInput) {
  if (!input.totalAmount || input.totalAmount <= 0) throw new Error("Invalid total amount");
  if (!input.settlementAsset) throw new Error("Settlement asset is required");
  if (!input.settlementAsset.network || !input.settlementAsset.code) throw new Error("Invalid settlement asset");
  if (!input.mode) throw new Error("Mode is required");

  if (input.mode === "FIXED") {
    if (!input.participants || input.participants.length === 0) throw new Error("Participants are required in FIXED mode");
    const totalShare = input.participants.reduce((sum, p) => sum + (p.share ?? 0), 0);
    if (totalShare !== 100) throw new Error("Shares must sum 100 in FIXED mode");
  }
}