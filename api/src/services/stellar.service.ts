import StellarSdk from "@stellar/stellar-sdk";
import BigNumber from "bignumber.js";
import { AssetConfig } from "../types/asset.types";

const server = new StellarSdk.Horizon.Server(
  "https://horizon-testnet.stellar.org"
);

const { Keypair, TransactionBuilder, Networks, Operation, Asset } = StellarSdk;

function toStellarAsset(config: AssetConfig): InstanceType<typeof Asset> {
  if (config.network !== "stellar") {
    throw new Error("Only stellar network supported for now");
  }
  if (config.type === "native") {
    return Asset.native();
  }
  if (config.type === "credit") {
    return new Asset(config.code, config.issuer);
  }
  throw new Error("Unsupported stellar asset type");
}

/**
 * Compares two Stellar assets by type and issuer.
 * Native (XLM) is treated as a distinct type — two credit assets with the same
 * code but different issuers are NOT considered a match, which is intentional:
 * USDC issued by Circle and USDC issued by a custom issuer are different assets
 * on the Stellar network.
 */
function assetsMatch(
  a: InstanceType<typeof Asset>,
  b: InstanceType<typeof Asset>
): boolean {
  if (a.isNative() && b.isNative()) return true;
  if (a.isNative() || b.isNative()) return false;
  return a.getCode() === b.getCode() && a.getIssuer() === b.getIssuer();
}

/**
 * Resolves the asset Migo holds and uses to fund settlements.
 * Configured via MIGO_SETTLEMENT_SOURCE env var.
 * Defaults to XLM (native) if not set, which covers the most common testnet setup.
 */
function settlementSourceAssetFromEnv(): InstanceType<typeof Asset> {
  const raw = process.env.MIGO_SETTLEMENT_SOURCE?.trim();
  if (!raw || raw.toLowerCase() === "native") {
    return Asset.native();
  }
  const colon = raw.indexOf(":");
  if (colon < 1 || colon === raw.length - 1) {
    throw new Error(
      "MIGO_SETTLEMENT_SOURCE must be \"native\" or ASSET_CODE:ISSUER (e.g. USDC:GBBD...)"
    );
  }
  return new Asset(raw.slice(0, colon), raw.slice(colon + 1));
}

/**
 * Converts a Horizon path hop object into a Stellar SDK Asset instance.
 * Horizon returns intermediate hops as plain objects; this normalizes them
 * so they can be passed directly to pathPaymentStrictReceive.
 */
function horizonAssetFromPathStep(step: {
  asset_type: string;
  asset_code?: string;
  asset_issuer?: string;
}): InstanceType<typeof Asset> {
  if (step.asset_type === "native") {
    return Asset.native();
  }
  if (!step.asset_code || !step.asset_issuer) {
    throw new Error("Invalid path hop from Horizon");
  }
  return new Asset(step.asset_code, step.asset_issuer);
}

/**
 * Executes the on-chain settlement payment from Migo's account to the merchant.
 *
 * When source and destination assets are the same, uses a simple Payment operation.
 * When they differ (e.g. Migo holds XLM but merchant expects USDC), uses
 * pathPaymentStrictReceive, which routes through the Stellar DEX and guarantees
 * the merchant receives the exact configured amount regardless of the exchange path.
 *
 * @param amount - Settlement amount denominated in the merchant's asset (settlementAsset).
 * @param settlementAsset - The asset the merchant expects to receive.
 * @returns The transaction hash of the submitted Stellar transaction.
 */
export async function sendSettlementPayment(
  amount: string,
  settlementAsset: AssetConfig
) {
  const MIGO_SECRET = process.env.MIGO_SECRET!;
  const MERCHANT_PUBLIC = process.env.MERCHANT_PUBLIC!;

  if (!MIGO_SECRET || !MERCHANT_PUBLIC) {
    throw new Error("Stellar env vars not loaded");
  }

  // Stellar amounts are limited to 7 decimal places (1 stroop = 0.0000001).
  // Truncating (ROUND_DOWN) rather than rounding ensures we never attempt to
  // deliver more than the available balance allows.
  const sanitizedAmount = new BigNumber(amount).toFixed(7, BigNumber.ROUND_DOWN);
  if (new BigNumber(sanitizedAmount).isLessThanOrEqualTo(0)) {
    throw new Error(
      `Settlement amount too small: ${amount} rounds to zero at 7 decimal precision (minimum is 0.0000001)`
    );
  }

  const sourceKeypair = Keypair.fromSecret(MIGO_SECRET);
  const sourcePublic = sourceKeypair.publicKey();
  const account = await server.loadAccount(sourcePublic);

  const destAsset = toStellarAsset(settlementAsset);
  const sourceAsset = settlementSourceAssetFromEnv();

  let operation: InstanceType<typeof Operation>;

  if (assetsMatch(sourceAsset, destAsset)) {
    operation = Operation.payment({
      destination: MERCHANT_PUBLIC,
      asset: destAsset,
      amount: sanitizedAmount,
    });
  } else {
    // Query Horizon for available DEX paths that can deliver exactly `amount`
    // of destAsset to the merchant, starting from sourceAsset.
    const pathCall = server.strictReceivePaths(
      [sourceAsset],
      destAsset,
      amount
    );
    const { records } = await pathCall.call();
    const record = records[0];
    if (!record) {
      const src = sourceAsset.isNative()
        ? "XLM"
        : `${sourceAsset.getCode()}:${sourceAsset.getIssuer()}`;
      const dest = destAsset.isNative()
        ? "XLM"
        : `${destAsset.getCode()}:${destAsset.getIssuer()}`;
      throw new Error(
        `No Stellar DEX path found to deliver ${amount} of destination asset to merchant (source=${src}, dest=${dest}). Check liquidity and trustlines.`
      );
    }

    // sendMax adds a 1% slippage buffer over the Horizon-quoted source amount.
    // This protects the payer against minor price movements between the path
    // query and transaction execution. If the actual cost exceeds sendMax,
    // the network rejects the transaction with op_over_source_max rather than
    // delivering a partial amount.
    const sendMax = new BigNumber(record.source_amount)
      .times(1.01)
      .toFixed(7, BigNumber.ROUND_UP);

    const path: InstanceType<typeof Asset>[] = (record.path || []).map(
      (hop: { asset_type: string; asset_code?: string; asset_issuer?: string }) =>
        horizonAssetFromPathStep(hop)
    );

    // pathPaymentStrictReceive guarantees the merchant receives exactly
    // `destAmount`, regardless of how many DEX hops the route requires.
    // The payer bears the exchange risk up to the sendMax ceiling.
    operation = Operation.pathPaymentStrictReceive({
      destination: MERCHANT_PUBLIC,
      sendAsset: sourceAsset,
      sendMax,
      destAsset,
      destAmount: sanitizedAmount,
      path,
    });
  }

  // setTimeout(30) ensures the transaction expires if not included in a ledger
  // within 30 seconds, preventing stale settlements from executing at an
  // outdated exchange rate.
  const transaction = new TransactionBuilder(account, {
    fee: StellarSdk.BASE_FEE,
    networkPassphrase: Networks.TESTNET,
  })
    .addOperation(operation)
    .setTimeout(30)
    .build();

  transaction.sign(sourceKeypair);

  const result = await server.submitTransaction(transaction);

  return result.hash;
}
