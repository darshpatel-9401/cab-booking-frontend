"use client";

import { useCallback, useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import RequireAuth from "@/components/RequireAuth";
import { Alert, Button, Card, Input, Spinner, cx } from "@/components/ui";
import { authFetch, errorText } from "@/lib/api";
import { formatMoney } from "@/lib/format";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const KIND_LABELS = { topup: "Top-up", ride_payment: "Ride payment" };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// "100" -> 10000, "99.5" -> 9950, "99.50" -> 9950, anything else -> null
function parseAmount(text) {
  const trimmed = text.trim();
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [whole, fraction = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

function TopupForm({ amount, currency, previousBalance, onCredited, onCancel }) {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function waitForCredit() {
    for (let i = 0; i < 10; i++) {
      const { res, body } = await authFetch("/api/wallet");
      if (res && res.ok && body.balance > previousBalance) {
        return body;
      }
      await sleep(1000);
    }
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) {
      return;
    }

    setBusy(true);
    setMessage("");

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (error) {
      setMessage(error.message || "The payment failed.");
      setBusy(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      setMessage("Payment accepted. Adding it to your wallet...");
      const updated = await waitForCredit();
      onCredited(updated);
      return;
    }

    setMessage("Payment status: " + (paymentIntent ? paymentIntent.status : "unknown"));
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement />
      <Button type="submit" size="lg" loading={busy} disabled={!stripe}>
        {busy ? "Processing..." : `Add ${formatMoney(amount, currency)}`}
      </Button>
      <Button variant="secondary" onClick={onCancel} disabled={busy}>
        Change amount
      </Button>
      {message && (
        <p role="status" className="break-words text-sm">
          {message}
        </p>
      )}
    </form>
  );
}

function WalletContent() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [amountText, setAmountText] = useState("");
  const [topup, setTopup] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const loadAll = useCallback(async () => {
    const [walletResult, txResult] = await Promise.all([
      authFetch("/api/wallet"),
      authFetch("/api/wallet/transactions?limit=20"),
    ]);

    if (walletResult.res && walletResult.res.ok) {
      setWallet(walletResult.body);
      setLoadError("");
    } else {
      setLoadError(errorText(walletResult.body, "Could not load your wallet."));
    }
    if (txResult.res && txResult.res.ok) {
      setTransactions(txResult.body);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  async function startTopup(e) {
    e.preventDefault();
    setNotice(null);

    const amount = parseAmount(amountText);
    if (amount === null) {
      setNotice({ tone: "warning", text: "Enter an amount like 100 or 99.50." });
      return;
    }
    if (amount < wallet.min_topup) {
      setNotice({
        tone: "warning",
        text: `The minimum top-up is ${formatMoney(wallet.min_topup, wallet.currency)}.`,
      });
      return;
    }
    if (amount > wallet.max_topup) {
      setNotice({
        tone: "warning",
        text: `The maximum top-up is ${formatMoney(wallet.max_topup, wallet.currency)}.`,
      });
      return;
    }

    setBusy(true);
    const { res, body } = await authFetch("/api/wallet/topup", "POST", { amount });
    if (res && res.ok) {
      setTopup(body);
    } else {
      setNotice({
        tone: res && res.status === 429 ? "warning" : "error",
        text: errorText(body, "Could not start the top-up. Check the amount."),
      });
    }
    setBusy(false);
  }

  function handleCredited(updated) {
    setTopup(null);
    setAmountText("");
    setNotice(
      updated
        ? { tone: "success", text: "Top-up complete." }
        : {
            tone: "info",
            text: "Payment received. Your balance will update in a moment.",
          }
    );
    loadAll();
  }

  if (!stripePromise) {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-10">
        <Alert tone="error">
          Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in frontend/.env.local
        </Alert>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-6">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Wallet</h1>
      <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
        Top up and pay for rides from your balance.
      </p>

      {loadError && (
        <Alert tone="error" className="mt-6">
          {loadError}
        </Alert>
      )}
      {!loadError && !wallet && (
        <Card className="mt-6 flex items-center gap-3 p-6 text-sm text-slate-600 dark:text-zinc-400">
          <Spinner className="h-5 w-5" />
          Loading...
        </Card>
      )}

      {wallet && (
        <div className="mt-6 grid gap-4 lg:grid-cols-[24rem_1fr]">
          <div className="flex min-w-0 flex-col gap-4">
            <Card className="p-6">
              <p className="text-sm text-slate-500 dark:text-zinc-400">
                Current balance
              </p>
              <p className="mt-1 text-4xl font-bold tracking-tight">
                {formatMoney(wallet.balance, wallet.currency)}
              </p>
            </Card>

            <Card className="flex flex-col gap-4 p-6">
              <h2 className="text-lg font-semibold">Add money</h2>

              {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}

              {!topup && (
                <form onSubmit={startTopup} className="flex flex-col gap-4">
                  <Input
                    id="amount"
                    label={`Amount (${wallet.currency.toUpperCase()})`}
                    hint={`From ${formatMoney(wallet.min_topup, wallet.currency)} to ${formatMoney(wallet.max_topup, wallet.currency)}`}
                    value={amountText}
                    onChange={(e) => setAmountText(e.target.value)}
                    inputMode="decimal"
                    placeholder="100"
                    autoComplete="off"
                  />
                  <Button type="submit" size="lg" loading={busy}>
                    Continue
                  </Button>
                </form>
              )}

              {topup && (
                <Elements
                  key={topup.client_secret}
                  stripe={stripePromise}
                  options={{ clientSecret: topup.client_secret }}
                >
                  <TopupForm
                    amount={topup.amount}
                    currency={topup.currency}
                    previousBalance={wallet.balance}
                    onCredited={handleCredited}
                    onCancel={() => setTopup(null)}
                  />
                </Elements>
              )}
            </Card>
          </div>

          <Card className="min-w-0 p-6">
            <h2 className="text-lg font-semibold">History</h2>
            {transactions && transactions.transactions.length === 0 && (
              <p className="mt-3 text-sm text-slate-600 dark:text-zinc-400">
                No transactions yet.
              </p>
            )}
            {transactions && transactions.transactions.length > 0 && (
              <ul className="mt-3 flex flex-col divide-y divide-slate-200 dark:divide-zinc-800">
                {transactions.transactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between gap-3 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium">{KIND_LABELS[tx.kind] || tx.kind}</p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        {new Date(tx.created_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={cx(
                          "font-semibold",
                          tx.amount > 0 && "text-emerald-600 dark:text-emerald-400"
                        )}
                      >
                        {tx.amount > 0 ? "+" : ""}
                        {formatMoney(tx.amount, tx.currency)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-zinc-400">
                        Balance {formatMoney(tx.balance_after, tx.currency)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {transactions && transactions.total > transactions.transactions.length && (
              <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
                Showing the latest {transactions.transactions.length} of{" "}
                {transactions.total}.
              </p>
            )}
          </Card>
        </div>
      )}
    </main>
  );
}

export default function WalletPage() {
  return (
    <RequireAuth title="Wallet" loginHref="/login" signupHref="/signup">
      <WalletContent />
    </RequireAuth>
  );
}