"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams } from "next/navigation";
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

function CheckoutForm({ rideId, amount, currency, onPaid }) {
  const stripe = useStripe();
  const elements = useElements();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function waitForBackend() {
    for (let i = 0; i < 10; i++) {
      const { body } = await authFetch(`/api/payments/rides/${rideId}`);
      if (body && body.payment && body.payment.status === "succeeded") {
        return true;
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    return false;
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
      setMessage(error.message || "Payment failed.");
      setBusy(false);
      return;
    }

    if (paymentIntent && paymentIntent.status === "succeeded") {
      setMessage("Stripe accepted the payment. Confirming with our server...");
      onPaid();
      const confirmed = await waitForBackend();
      setMessage(
        confirmed
          ? "Payment confirmed. Thank you!"
          : "Stripe accepted the payment, but our server has not confirmed it yet. Check again in a moment."
      );
      setDone(true);
    } else {
      setMessage("Payment status: " + (paymentIntent ? paymentIntent.status : "unknown"));
    }

    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-4">
      <PaymentElement />
      <button
        type="submit"
        disabled={!stripe || busy || done}
        className="rounded bg-black p-2 text-white disabled:opacity-50"
      >
        {busy ? "Processing..." : `Pay ${formatMoney(amount, currency)}`}
      </button>
      <p className="text-sm break-words">{message}</p>
    </form>
  );
}

function PayContent() {
  const params = useParams();
  const rideId = params.rideId;

  const [intent, setIntent] = useState(null);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);
  const [promoInput, setPromoInput] = useState("");
  const [promoMessage, setPromoMessage] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletMessage, setWalletMessage] = useState("");
  const [paidByWallet, setPaidByWallet] = useState(false);

  useEffect(() => {
    if (!rideId) {
      setError("Invalid payment link.");
      return;
    }

    let cancelled = false;

    async function loadIntent() {
      const { res, body } = await authFetch(
        `/api/payments/rides/${rideId}/intent`,
        "POST"
      );
      if (cancelled) {
        return;
      }
      if (res && res.ok) {
        setIntent(body);
      } else {
        setError(errorText(body, "Could not start the payment."));
      }
    }

    loadIntent();
    return () => {
      cancelled = true;
    };
  }, [rideId]);

  useEffect(() => {
    let cancelled = false;

    async function loadWallet() {
      const { res, body } = await authFetch("/api/wallet");
      if (!cancelled && res && res.ok) {
        setWallet(body);
      }
    }

    loadWallet();
    return () => {
      cancelled = true;
    };
  }, []);

  async function applyPromo() {
    const code = promoInput.trim();
    if (!code) {
      return;
    }

    setPromoBusy(true);
    setPromoMessage("");

    const { res, body } = await authFetch(
      `/api/payments/rides/${rideId}/intent`,
      "POST",
      { promo_code: code }
    );

    if (res && res.ok) {
      setIntent(body);
      setPromoInput("");
      setPromoMessage(
        `Promo applied. You save ${formatMoney(body.discount_amount, body.currency)}.`
      );
    } else {
      setPromoMessage(errorText(body, "Could not apply this code."));
    }

    setPromoBusy(false);
  }

  async function payWithWallet() {
    setWalletBusy(true);
    setWalletMessage("");

    const { res, body } = await authFetch(
      `/api/payments/rides/${rideId}/pay-with-wallet`,
      "POST"
    );

    if (res && res.ok) {
      setPaidByWallet(true);
      setWallet({ balance: body.balance_after, currency: body.currency });
      setWalletMessage("Paid from your wallet. Thank you!");
    } else {
      setWalletMessage(errorText(body, "Could not pay from the wallet."));
    }

    setWalletBusy(false);
  }

  if (!stripePromise) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <p>Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in frontend/.env.local</p>
      </main>
    );
  }

  const canUseWallet = intent && wallet && !paid && !paidByWallet;
  const enoughBalance = canUseWallet && wallet.balance >= intent.amount;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-2xl font-bold">Pay for your ride</h1>

      {error && <p className="text-sm break-words">{error}</p>}
      {!error && !intent && <p>Loading...</p>}

      {intent && intent.discount_amount > 0 && (
        <div className="w-full max-w-md text-sm">
          <p>Fare: {formatMoney(intent.original_amount, intent.currency)}</p>
          <p>Discount: -{formatMoney(intent.discount_amount, intent.currency)}</p>
        </div>
      )}

      {intent && !paid && !paidByWallet && (
        <div className="flex w-full max-w-md flex-col gap-2">
          <div className="flex gap-2">
            <input
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              placeholder="Promo code"
              className="flex-1 rounded border p-2"
            />
            <button
              type="button"
              onClick={applyPromo}
              disabled={promoBusy || !promoInput.trim()}
              className="rounded border px-4 py-2 disabled:opacity-50"
            >
              {promoBusy ? "Applying..." : "Apply"}
            </button>
          </div>
          {promoMessage && <p className="text-sm break-words">{promoMessage}</p>}
        </div>
      )}

      {canUseWallet && (
        <div className="flex w-full max-w-md flex-col gap-2 text-sm">
          <p>Wallet balance: {formatMoney(wallet.balance, wallet.currency)}</p>
          <button
            type="button"
            onClick={payWithWallet}
            disabled={walletBusy || !enoughBalance}
            className="rounded border px-4 py-2 disabled:opacity-50"
          >
            {walletBusy
              ? "Paying..."
              : `Pay ${formatMoney(intent.amount, intent.currency)} from wallet`}
          </button>
          {!enoughBalance && <p>Not enough wallet balance.</p>}
        </div>
      )}

      {walletMessage && <p className="text-sm break-words">{walletMessage}</p>}

      {intent && !paidByWallet && (
        <Elements
          key={`${intent.client_secret}-${intent.amount}`}
          stripe={stripePromise}
          options={{ clientSecret: intent.client_secret }}
        >
          <CheckoutForm
            rideId={rideId}
            amount={intent.amount}
            currency={intent.currency}
            onPaid={() => setPaid(true)}
          />
        </Elements>
      )}
    </main>
  );
}

export default function PayPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center p-4">
          <p>Loading...</p>
        </main>
      }
    >
      <PayContent />
    </Suspense>
  );
}