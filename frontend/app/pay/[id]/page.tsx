'use client';
import { api } from '@/lib/api';
import { fetchSplit } from '@/lib/api';
import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { ArrowLeft, Wallet, ExternalLink, ArrowRight, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createPomeloPayment } from '@/lib/payment-providers/pomelo';

const CURRENCIES = [
  { code: 'XLM', name: 'Stellar Lumens', icon: '💎', color: 'from-blue-500 to-blue-600' },
  { code: 'USDC', name: 'USD Coin', icon: '💵', color: 'from-[#00D9FF] to-[#00B8DD]' },
  { code: 'ARS', name: 'Pesos Argentinos', icon: '🇦🇷', color: 'from-slate-600 to-slate-700' },
  { code: 'BTC', name: 'Bitcoin', icon: '₿', color: 'from-orange-500 to-orange-600' },
  { code: 'ETH', name: 'Ethereum', icon: 'Ξ', color: 'from-purple-500 to-purple-600' },
];

const WALLETS = [
  { 
    name: 'Freighter', 
    icon: '🔷',
    available: typeof window !== 'undefined' && window.freighter !== undefined,
    action: 'freighter'
  },
  { 
    name: 'LOBSTR', 
    icon: '🦞',
    available: typeof window !== 'undefined' && /Lobstr/i.test(navigator.userAgent),
    action: 'lobstr'
  },
  { 
    name: 'Albedo', 
    icon: '🌟',
    available: true,
    action: 'albedo'
  },
  { 
    name: 'xBull', 
    icon: '🐂',
    available: typeof window !== 'undefined' && window.xBullSDK !== undefined,
    action: 'xbull'
  },
];

export default function PaySplitPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const splitId = resolvedParams.id;

  const router = useRouter();

  const [split, setSplit] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCurrency, setSelectedCurrency] = useState('USDC');
  const [showWalletSelector, setShowWalletSelector] = useState(false);

  // Fetch del split
  useEffect(() => {
    fetchSplit(splitId)
      .then(data => {
        setSplit(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [splitId]);

  // Manejo de loading y error
  if (loading) return <div className="p-8 text-white">Cargando split...</div>;
  if (error) return <div className="p-8 text-red-500">Error: {error}</div>;
  if (!split) return null;

  // Cálculo de tu parte
const searchParams = new URLSearchParams(window.location.search);
const personas = parseInt(searchParams.get('personas') || '1');
const shareAmount = split.totalAmount / personas;




  const baseCurrency = split.settlementAsset.code;

  // Conversión de moneda
  const rates: { [key: string]: number } = {
    'XLM': 11.68,
    'USDC': 1,
    'ARS': 1175,
    'BTC': 0.000015,
    'ETH': 0.00031,
  };
  const amountInSelectedCurrency = (shareAmount * rates[selectedCurrency]).toFixed(
    selectedCurrency === 'BTC' || selectedCurrency === 'ETH' ? 6 : 2
  );

const handlePayWithCard = async () => {
    try {
      const currency = selectedCurrency === 'ARS' ? 'ARS' : 'USD';
      const { checkoutUrl } = await createPomeloPayment({
        amount: parseFloat(amountInSelectedCurrency),
        currency: currency as 'ARS' | 'USD',
        splitId: split.id,
      });
      window.location.href = checkoutUrl;
    } catch (err: any) {
      alert('Error al iniciar el pago con tarjeta: ' + err.message);
    }
  };

const handlePayWithWallet = async (walletAction: string) => {
    try {
      const data = await api.payments.register(split.id, {
        payerId: `user-${walletAction}-${Date.now()}`,
        method: "STELLAR",
        originalAsset: selectedCurrency,
        originalAmount: shareAmount,
      });

      // router.push(`/pay/${split.id}/success`); reemplazo por:
      router.push(`/pay/${split.id}/success?txHash=${data.stellarTxHash || ''}`);
    } catch (err: any) {
      alert('Error al registrar el pago: ' + err.message);
    }
  };

  const availableWallets = WALLETS.filter(w => w.available);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="px-4 pt-6 pb-4">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg hover:bg-slate-700/50 transition-colors mb-4"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>

        <div className="text-center mb-8">
          <Image
            src="/migo-logo.png"
            alt="Migo"
            width={200}
            height={80}
            priority
            className="w-auto h-auto max-w-xs mx-auto"
          />
        </div>
      </div>

      <div className="px-4 py-6 space-y-6 max-w-md mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="glass-card p-6 bg-[#00D9FF]/5 border-[#00D9FF]/20">
            <p className="text-sm text-slate-400 mb-2">Tu parte:</p>
            <p className="text-5xl font-bold text-gradient mb-1">
              {shareAmount.toFixed(2)}
            </p>
            <p className="text-lg text-slate-300">{baseCurrency}</p>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-3">
          <label className="text-sm font-medium text-slate-400 block text-center">
            Elige con qué moneda pagar:
          </label>
          <div className="grid grid-cols-5 gap-2">
            {CURRENCIES.map((currency) => (
              <button
                key={currency.code}
                onClick={() => setSelectedCurrency(currency.code)}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-all
                  ${selectedCurrency === currency.code
                    ? `bg-gradient-to-r ${currency.color} text-white scale-105 shadow-lg`
                    : 'bg-slate-800/50 text-slate-400 hover:bg-slate-700/50'}`}
              >
                <span className="text-2xl">{currency.icon}</span>
                <span className="text-xs font-semibold">{currency.code}</span>
              </button>
            ))}
          </div>
        </motion.div>

        {selectedCurrency !== baseCurrency && (
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="glass-card p-4 text-center bg-slate-800/30">
            <p className="text-sm text-slate-400 mb-1">Pagarás aproximadamente:</p>
            <p className="text-3xl font-bold text-[#00D9FF]">
              {amountInSelectedCurrency} {selectedCurrency}
            </p>
            <p className="text-xs text-slate-500 mt-2">Tasa de cambio estimada</p>
          </motion.div>
        )}

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Button
            onClick={() => setShowWalletSelector(true)}
            className="w-full h-16 text-lg font-semibold bg-gradient-to-r from-[#00D9FF] to-[#00B8DD] hover:opacity-90 text-white shadow-lg shadow-[#00D9FF]/20"
          >
            <Wallet className="w-6 h-6 mr-2" /> Pagar con mi Wallet
          </Button>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Button
            onClick={handlePayWithCard}
            variant="outline"
            className="w-full h-16 text-lg font-semibold border-2 border-slate-600 hover:border-[#00D9FF] hover:bg-[#00D9FF]/5 text-white"
          >
            <CreditCard className="w-6 h-6 mr-2" /> Pagar con tarjeta
          </Button>
        </motion.div>

        {showWalletSelector && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowWalletSelector(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              className="bg-slate-900 rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 border border-slate-700"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-xl font-bold mb-4 text-center">Elige tu wallet</h3>

              <div className="space-y-3 mb-4">
                {availableWallets.map((wallet) => (
                  <Button
                    key={wallet.action}
                    onClick={() => handlePayWithWallet(wallet.action)}
                    variant="outline"
                    className="w-full h-16 justify-between border-2 hover:border-[#00D9FF] hover:bg-[#00D9FF]/5"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{wallet.icon}</span>
                      <span className="font-semibold text-lg">{wallet.name}</span>
                    </div>
                    <ExternalLink className="w-5 h-5 text-slate-400" />
                  </Button>
                ))}
              </div>

              {availableWallets.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-slate-400 mb-4">No se detectaron wallets instaladas</p>
                  <Button
                    onClick={() => window.open('https://www.freighter.app/', '_blank')}
                    variant="link"
                    className="text-[#00D9FF] hover:underline text-sm"
                  >
                    Instalar Freighter <ArrowRight className="w-3 h-3 ml-1 inline" />
                  </Button>
                </div>
              )}

              <Button onClick={() => setShowWalletSelector(false)} variant="ghost" className="w-full mt-4">
                Cancelar
              </Button>
            </motion.div>
          </motion.div>
        )}

        <div className="text-center pt-4">
          <p className="text-xs text-slate-500">Powered by Stellar · Secured by Soroban</p>
        </div>
      </div>
    </div>
  );
}
