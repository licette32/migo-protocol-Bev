import { AssetConfig } from "../types/asset.types";

// Evaluated at module load time so the URL is consistent across all calls
// within a single server process. Changing STELLAR_NETWORK requires a restart.
const HORIZON_URL = process.env.STELLAR_NETWORK === "mainnet"
  ? process.env.STELLAR_HORIZON_URL_MAINNET ?? "https://horizon.stellar.org"
  : process.env.STELLAR_HORIZON_URL_TESTNET ?? "https://horizon-testnet.stellar.org";

function destinationAssetsParam(settlement: AssetConfig): string {
  if (settlement.network !== "stellar") {
    throw new Error("Solo se convierte hacia settlement en red stellar");
  }
  if (settlement.type === "native") {
    return "native";
  }
  return `${settlement.code}:${settlement.issuer}`;
}

function appendStrictSendSource(
  params: URLSearchParams,
  fromAsset: string
): void {
  if (fromAsset === "XLM") {
    params.set("source_asset_type", "native");
    return;
  }
  const issuer = process.env.ISSUER_PUBLIC_ASSET;
  if (!issuer) {
    throw new Error("ISSUER_PUBLIC_ASSET es requerido para pagos en activos crédito");
  }
  params.set("source_asset_type", "credit_alphanum4");
  params.set("source_asset_code", fromAsset);
  params.set("source_asset_issuer", issuer);
}

/**
 * Fetches the live exchange rate from the Stellar DEX via Horizon's
 * /paths/strict-send endpoint. Returns the ratio destAmount/srcAmount
 * from the best available path.
 *
 * Uses strict-send (not strict-receive) because the payer specifies how much
 * they are sending; the resulting destination amount is used to compute
 * convertedAmount for the split's remaining balance check.
 *
 * Note: the returned rate is a JS number. For display and storage purposes
 * this is acceptable, but the actual on-chain amounts in stellar.service.ts
 * are sanitized with BigNumber.js to avoid floating-point errors at the
 * 7-decimal precision required by the Stellar protocol (1 stroop = 0.0000001).
 */
export async function getLiveConversionRate(
  fromAsset: string,
  settlementAsset: AssetConfig,
  amount: number
): Promise<number> {
  if (fromAsset === settlementAsset.code) {
    if (settlementAsset.type === "native" && fromAsset === "XLM") return 1;
    if (
      settlementAsset.type === "credit" &&
      process.env.ISSUER_PUBLIC_ASSET === settlementAsset.issuer
    ) {
      return 1;
    }
  }

  const dest = destinationAssetsParam(settlementAsset);
  const params = new URLSearchParams();
  appendStrictSendSource(params, fromAsset);
  params.set("source_amount", String(amount));
  params.set("destination_assets", dest);

  const url = `${HORIZON_URL}/paths/strict-send?${params.toString()}`;
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Horizon no disponible: ${response.status}`);
  }

  const data = (await response.json()) as {
    _embedded?: { records?: Array<Record<string, string>> };
  };
  const records = data._embedded?.records ?? [];
  if (!records.length) {
    throw new Error(
      `No hay liquidez en el Stellar DEX para cambiar ${amount} ${fromAsset} por ${dest}. ` +
        `En testnet suele haber rutas hacia USDC de Circle (issuer GBBD47...). ` +
        `Si usas un emisor propio, necesitas ofertas/liquidez contra XLM en el DEX.`
    );
  }

  const best = records[0];
  const destAmt = Number(best.destination_amount);
  const srcAmt = Number(best.source_amount);
  if (!srcAmt || Number.isNaN(destAmt)) {
    throw new Error("Respuesta de path inválida desde Horizon");
  }
  return destAmt / srcAmt;
}

export function getMockConversionRate(asset: string): number {
  const rates: Record<string, number> = {
    USDC: 1,
    XLM: 1,
    ARS_BANK: 0.002,
    BRL_BANK: 0.18,
  };

  return rates[asset] ?? 1;
}

export async function convertToSettlement(
  originalAmount: number,
  originalAsset: string,
  settlementAsset: AssetConfig
) {
  if (settlementAsset.network === "stellar") {
    const sameNative =
      originalAsset === "XLM" && settlementAsset.type === "native";
    const sameCredit =
      settlementAsset.type === "credit" &&
      originalAsset === settlementAsset.code &&
      process.env.ISSUER_PUBLIC_ASSET === settlementAsset.issuer;
    if (sameNative || sameCredit) {
      return {
        conversionRate: 1,
        convertedAmount: originalAmount,
      };
    }
  }

  try {
    const rate = await getLiveConversionRate(
      originalAsset,
      settlementAsset,
      originalAmount
    );
    return {
      conversionRate: rate,
      convertedAmount: originalAmount * rate,
    };
  } catch (err) {
    console.error(`[Conversion] Horizon falló: ${err}`);
    throw new Error(`No se pudo obtener tasa de conversión: ${err}`);
  }
}
