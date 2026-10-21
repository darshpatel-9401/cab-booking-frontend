"use client";

import { useCallback, useEffect, useState } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { supabase } from "@/lib/supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL;
const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

const KIND_LABELS = { topup: "Top-up", ride_payment: "Ride payment" };

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function authFetch(path, method = "GET", payload = null) {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) {
    return { res: null, body: { detail: "You are not logged in. Go to /login." } };
  }

  const headers = { Authorization: `Bearer ${session.access_token}` };
  const options = { method: method, headers: headers };
  if (payload) {
    headers["Content-Type"] = "application/json";
    options.body = JSON.stringify(payload);
  }

  try {
    const res = await fetch(`${API_URL}${path}`, options);
    const body = await res.json();
    return { res, body };
  } catch (err) {
    return { res: null, body: { detail: "Could not reach the backend." } };
  }
}

// Always returns plain text, even if the backend sends a list of validation errors
function errorText(body, fallback) {
  const detail = body && body.detail;
  if (typeof detail === "string") {
    return detail;
  }
  return fallback;
}

function formatMoney(amount, currency) {
  try {
    return (amount / 100).toLocaleString(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    });
  } catch (err) {
    return `${amount / 100} ${currency.toUpperCase()}`;
  }
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
      setMessage("Stripe accepted the payment. Adding it to your wallet...");
      const updated = await waitForCredit();
      onCredited(updated);
      return;
    }

    setMessage("Payment status: " + (paymentIntent ? paymentIntent.status : "unknown"));
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || busy}
        className="rounded bg-black p-2 text-white disabled:opacity-50"
      >
        {busy ? "Processing..." : `Add ${formatMoney(amount, currency)}`}
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="rounded border p-2 disabled:opacity-50"
      >
        Change amount
      </button>
      <p className="text-sm break-words">{message}</p>
    </form>
  );
}

export default function WalletPage() {
  const [wallet, setWallet] = useState(null);
  const [transactions, setTransactions] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [amountText, setAmountText] = useState("");
  const [topup, setTopup] = useState(null);
  const [message, setMessage] = useState("");
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
    setMessage("");

    const amount = parseAmount(amountText);
    if (amount === null) {
      setMessage("Enter an amount like 100 or 99.50.");
      return;
    }
    if (amount < wallet.min_topup) {
      setMessage(
        `The minimum top-up is ${formatMoney(wallet.min_topup, wallet.currency)}.`
      );
      return;
    }
    if (amount > wallet.max_topup) {
      setMessage(
        `The maximum top-up is ${formatMoney(wallet.max_topup, wallet.currency)}.`
      );
      return;
    }

    setBusy(true);
    const { res, body } = await authFetch("/api/wallet/topup", "POST", { amount });
    if (res && res.ok) {
      setTopup(body);
    } else {
      setMessage(errorText(body, "Could not start the top-up. Check the amount."));
    }
    setBusy(false);
  }

  function handleCredited(updated) {
    setTopup(null);
    setAmountText("");
    setMessage(
      updated
        ? "Top-up complete."
        : "Payment received. Your balance will update in a moment."
    );
    loadAll();
  }

  if (!stripePromise) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p>Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in frontend/.env.local</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 p-4">
      <h1 className="text-2xl font-bold">Your wallet</h1>

      {loadError && <p className="text-sm break-words">{loadError}</p>}
      {!loadError && !wallet && <p>Loading...</p>}

      {wallet && (
        <>
          <section>
            <p className="text-sm">Balance</p>
            <p className="text-3xl font-bold">
              {formatMoney(wallet.balance, wallet.currency)}
            </p>
          </section>

          <section className="flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Add money</h2>

            {!topup && (
              <form onSubmit={startTopup} className="flex flex-col gap-2">
                <label htmlFor="amount" className="text-sm">
                  Amount ({wallet.currency.toUpperCase()}), from{" "}
                  {formatMoney(wallet.min_topup, wallet.currency)} to{" "}
                  {formatMoney(wallet.max_topup, wallet.currency)}
                </label>
                <input
                  id="amount"
                  value={amountText}
                  onChange={(e) => setAmountText(e.target.value)}
                  inputMode="decimal"
                  placeholder="100"
                  className="rounded border p-2"
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded bg-black p-2 text-white disabled:opacity-50"
                >
                  {busy ? "Starting..." : "Continue"}
                </button>
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

            {message && <p className="text-sm break-words">{message}</p>}
          </section>

          <section className="flex flex-col gap-2">
            <h2 className="text-lg font-semibold">History</h2>
            {transactions && transactions.transactions.length === 0 && (
              <p className="text-sm">No transactions yet.</p>
            )}
            {transactions && transactions.transactions.length > 0 && (
              <ul className="flex flex-col gap-2">
                {transactions.transactions.map((tx) => (
                  <li
                    key={tx.id}
                    className="flex items-center justify-between rounded border p-2 text-sm"
                  >
                    <div>
                      <p className="font-medium">{KIND_LABELS[tx.kind] || tx.kind}</p>
                      <p>{new Date(tx.created_at).toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {tx.amount > 0 ? "+" : ""}
                        {formatMoney(tx.amount, tx.currency)}
                      </p>
                      <p>Balance {formatMoney(tx.balance_after, tx.currency)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            {transactions && transactions.total > transactions.transactions.length && (
              <p className="text-sm">
                Showing the latest {transactions.transactions.length} of{" "}
                {transactions.total}.
              </p>
            )}
          </section>
        </>
      )}
    </main>
  );
}