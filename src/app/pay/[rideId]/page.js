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
import RequireAuth from "@/components/RequireAuth";
import {
  Alert,
  Button,
  ButtonLink,
  Card,
  Input,
  Spinner,
} from "@/components/ui";
import { authFetch, errorText } from "@/lib/api";
import { formatMoney } from "@/lib/format";

const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
const stripePromise = publishableKey ? loadStripe(publishableKey) : null;

function Row({ label, value, strong }) {
  return (
    <div className="flex items-center justify-between">
      <dt
        className={
          strong ? "font-semibold" : "text-sm text-slate-600 dark:text-zinc-400"
        }
      >
        {label}
      </dt>
      <dd className={strong ? "text-xl font-bold" : "text-sm font-medium"}>
        {value}
      </dd>
    </div>
  );
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
      setMessage("Payment accepted. Confirming with our server...");
      onPaid();
      const confirmed = await waitForBackend();
      setMessage(
        confirmed
          ? "Payment confirmed. Thank you!"
          : "Payment accepted, but our server has not confirmed it yet. Check your rides in a moment."
      );
      setDone(true);
    } else {
      setMessage("Payment status: " + (paymentIntent ? paymentIntent.status : "unknown"));
    }

    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <PaymentElement />
      <Button type="submit" size="lg" loading={busy} disabled={!stripe || done}>
        {busy ? "Processing..." : `Pay ${formatMoney(amount, currency)} by card`}
      </Button>
      {message && (
        <p role="status" className="break-words text-sm">
          {message}
        </p>
      )}
      {done && <ButtonLink href="/rides">Back to my rides</ButtonLink>}
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
  const [promoNotice, setPromoNotice] = useState(null);
  const [promoBusy, setPromoBusy] = useState(false);
  const [wallet, setWallet] = useState(null);
  const [walletBusy, setWalletBusy] = useState(false);
  const [walletNotice, setWalletNotice] = useState(null);
  const [paidByWallet, setPaidByWallet] = useState(false);

  useEffect(() => {
    if (!rideId) {
      setError("Invalid payment link.");
      return undefined;
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

  async function applyPromo(e) {
    e.preventDefault();
    const code = promoInput.trim();
    if (!code) {
      return;
    }

    setPromoBusy(true);
    setPromoNotice(null);

    const { res, body } = await authFetch(
      `/api/payments/rides/${rideId}/intent`,
      "POST",
      { promo_code: code }
    );

    if (res && res.ok) {
      setIntent(body);
      setPromoInput("");
      setPromoNotice({
        tone: "success",
        text: `Promo applied. You save ${formatMoney(body.discount_amount, body.currency)}.`,
      });
    } else {
      setPromoNotice({
        tone: "error",
        text: errorText(body, "Could not apply this code."),
      });
    }

    setPromoBusy(false);
  }

  async function payWithWallet() {
    setWalletBusy(true);
    setWalletNotice(null);

    const { res, body } = await authFetch(
      `/api/payments/rides/${rideId}/pay-with-wallet`,
      "POST"
    );

    if (res && res.ok) {
      setPaidByWallet(true);
      setWallet({ balance: body.balance_after, currency: body.currency });
      setWalletNotice({ tone: "success", text: "Paid from your wallet. Thank you!" });
    } else {
      setWalletNotice({
        tone: "error",
        text: errorText(body, "Could not pay from the wallet."),
      });
    }

    setWalletBusy(false);
  }

  if (!stripePromise) {
    return (
      <main className="mx-auto w-full max-w-xl px-4 py-10">
        <Alert tone="error">
          Missing NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in frontend/.env.local
        </Alert>
      </main>
    );
  }

  const finished = paid || paidByWallet;
  const canUseWallet = intent && wallet && !finished;
  const enoughBalance = canUseWallet && wallet.balance >= intent.amount;

  return (
    <main className="mx-auto flex w-full max-w-xl flex-col gap-4 px-4 py-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
          Pay for your ride
        </h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-zinc-400">
          Choose how you would like to pay.
        </p>
      </div>

      {error && (
        <div className="flex flex-col items-start gap-3">
          <Alert tone="error" className="w-full">
            {error}
          </Alert>
          <ButtonLink href="/rides" variant="secondary">
            Back to my rides
          </ButtonLink>
        </div>
      )}

      {!error && !intent && (
        <Card className="flex items-center gap-3 p-6 text-sm text-slate-600 dark:text-zinc-400">
          <Spinner className="h-5 w-5" />
          Loading...
        </Card>
      )}

      {intent && (
        <Card className="p-5">
          <dl className="flex flex-col gap-2">
            <Row
              label="Fare"
              value={formatMoney(intent.original_amount, intent.currency)}
            />
            {intent.discount_amount > 0 && (
              <Row
                label="Discount"
                value={`-${formatMoney(intent.discount_amount, intent.currency)}`}
              />
            )}
            <div className="mt-1 border-t border-slate-200 pt-3 dark:border-zinc-800">
              <Row
                label="Total"
                value={formatMoney(intent.amount, intent.currency)}
                strong
              />
            </div>
          </dl>
        </Card>
      )}

      {intent && !finished && (
        <Card className="p-5">
          <form onSubmit={applyPromo} className="flex flex-col gap-3">
            <Input
              id="promo"
              label="Promo code"
              value={promoInput}
              onChange={(e) => setPromoInput(e.target.value)}
              autoComplete="off"
            />
            <Button
              type="submit"
              variant="secondary"
              loading={promoBusy}
              disabled={!promoInput.trim()}
              className="self-start"
            >
              Apply code
            </Button>
            {promoNotice && <Alert tone={promoNotice.tone}>{promoNotice.text}</Alert>}
          </form>
        </Card>
      )}

      {canUseWallet && (
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="font-semibold">Pay from your wallet</h2>
          <p className="text-sm text-slate-600 dark:text-zinc-400">
            Balance: {formatMoney(wallet.balance, wallet.currency)}
          </p>
          <Button
            onClick={payWithWallet}
            loading={walletBusy}
            disabled={!enoughBalance}
          >
            Pay {formatMoney(intent.amount, intent.currency)} from wallet
          </Button>
          {!enoughBalance && (
            <p className="text-sm text-slate-600 dark:text-zinc-400">
              Not enough wallet balance.{" "}
              <a
                href="/wallet"
                className="font-semibold text-indigo-600 underline underline-offset-4 dark:text-indigo-400"
              >
                Add money
              </a>
            </p>
          )}
        </Card>
      )}

      {walletNotice && <Alert tone={walletNotice.tone}>{walletNotice.text}</Alert>}

      {paidByWallet && (
        <div className="flex flex-wrap gap-2">
          <ButtonLink href="/rides">Back to my rides</ButtonLink>
          <ButtonLink href="/book" variant="secondary">
            Book another ride
          </ButtonLink>
        </div>
      )}

      {intent && !paidByWallet && (
        <Card className="p-5">
          <h2 className="mb-4 font-semibold">Pay by card</h2>
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
        </Card>
      )}
    </main>
  );
}

function LoadingMain() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <Card className="flex items-center gap-3 p-6 text-sm text-slate-600 dark:text-zinc-400">
        <Spinner className="h-5 w-5" />
        Loading...
      </Card>
    </main>
  );
}

export default function PayPage() {
  return (
    <Suspense fallback={<LoadingMain />}>
      <RequireAuth
        title="Pay for your ride"
        loginHref="/login"
        signupHref="/signup"
      >
        <PayContent />
      </RequireAuth>
    </Suspense>
  );
}