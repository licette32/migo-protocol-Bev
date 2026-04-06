import dotenv from "dotenv";
dotenv.config();
import { createApp } from "./app";
const PORT = process.env.PORT || 3001;

const app = createApp();


console.log("ENV CHECK:", {
  migo: !!process.env.MIGO_SECRET,
  merchant: process.env.MERCHANT_PUBLIC,
  issuer: process.env.ISSUER_PUBLIC,
  source: process.env.MIGO_SETTLEMENT_SOURCE
});

app.listen(PORT, () => {
  console.log(`🚀 Migo API running on port ${PORT}`);
});