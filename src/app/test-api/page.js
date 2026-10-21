"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

export default function TestApiPage() {
  const [result, setResult] = useState("");
  const [lastRideId, setLastRideId] = useState("");
  const [manualRideId, setManualRideId] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [otherUserId, setOtherUserId] = useState("");
  const [promoCode, setPromoCode] = useState("");
  const [topupAmount, setTopupAmount] = useState("5000");

  async function callApi(path, method, payload) {
    setResult("Loading...");

    const { data } = await supabase.auth.getSession();
    const session = data.session;

    if (!session) {
      setResult("You are not logged in. Go to /login first.");
      return null;
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
      setResult(`Status: ${res.status}\n` + JSON.stringify(body, null, 2));
      return body;
    } catch (err) {
      setResult("Could not reach the backend: " + err.message);
      return null;
    }
  }

  async function requestRide() {
    const body = await callApi("/api/rides/request", "POST", {
      pickup_lat: 51.508,
      pickup_lng: -0.1281,
      drop_lat: 51.5055,
      drop_lng: -0.0754,
    });
    if (body && body.ride_id) {
      setLastRideId(body.ride_id);
    }
  }

  function checkStatus() {
    if (!lastRideId) {
      setResult("Request a ride first, so there is a ride id to check.");
      return;
    }
    callApi(`/api/rides/${lastRideId}/status`, "GET");
  }

  function checkUnknownRide() {
    callApi("/api/rides/00000000-0000-0000-0000-000000000000/status", "GET");
  }

  function matchRide() {
    if (!lastRideId) {
      setResult("Request a ride first, so there is a ride id to match.");
      return;
    }
    callApi(`/api/rides/${lastRideId}/match`, "POST");
  }

    async function getCurrentRide() {
    const body = await callApi("/api/drivers/current-ride", "GET");
    if (body && body.ride && body.ride.ride_id) {
      setLastRideId(body.ride.ride_id);
    }
  }

  function startRide() {
    if (!lastRideId) {
      setResult("Click GET current ride first, so there is a ride id to start.");
      return;
    }
    callApi(`/api/rides/${lastRideId}/start`, "POST");
  }

  function completeRide() {
    if (!lastRideId) {
      setResult("Click GET current ride first, so there is a ride id to complete.");
      return;
    }
    callApi(`/api/rides/${lastRideId}/complete`, "POST");
  }

  function cancelRide() {
    if (!lastRideId) {
      setResult("Request a ride first, so there is a ride id to cancel.");
      return;
    }
    callApi(`/api/rides/${lastRideId}/cancel`, "POST");
  }

  function createPaymentIntent() {
    const rideId = manualRideId.trim() || lastRideId;
    if (!rideId) {
      setResult("Paste a ride id in the box first.");
      return;
    }
    callApi(`/api/payments/rides/${rideId}/intent`, "POST");
  }

  function getPaymentStatus() {
    const rideId = manualRideId.trim() || lastRideId;
    if (!rideId) {
      setResult("Paste a ride id in the box first.");
      return;
    }
    callApi(`/api/payments/rides/${rideId}`, "GET");
  }

  function getReceipt() {
    const rideId = manualRideId.trim() || lastRideId;
    if (!rideId) {
      setResult("Paste a ride id in the box first.");
      return;
    }
    callApi(`/api/rides/${rideId}/receipt`, "GET");
  }

    async function downloadReceiptPdf() {
    const rideId = manualRideId.trim() || lastRideId;
    if (!rideId) {
      setResult("Paste a ride id in the box first.");
      return;
    }

    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      setResult("You are not logged in. Go to /login first.");
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/rides/${rideId}/receipt/pdf`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (!res.ok) {
        const body = await res.json();
        setResult(`Status: ${res.status}\n` + JSON.stringify(body, null, 2));
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `receipt-${rideId.slice(0, 8)}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
      setResult("Receipt PDF downloaded.");
    } catch (err) {
      setResult("Could not download the receipt: " + err.message);
    }
  }

  function emailReceipt() {
    const rideId = manualRideId.trim() || lastRideId;
    if (!rideId) {
      setResult("Paste a ride id in the box first.");
      return;
    }
    callApi(`/api/rides/${rideId}/receipt/email`, "POST");
  }

  function postReview(rating, comment) {
    const rideId = manualRideId.trim() || lastRideId;
    if (!rideId) {
      setResult("Paste a ride id in the box first.");
      return;
    }
    const payload = { rating: rating };
    if (comment) {
      payload.comment = comment;
    }
    callApi(`/api/rides/${rideId}/review`, "POST", payload);
  }

  async function getMyRating() {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session) {
      setResult("You are not logged in. Go to /login first.");
      return;
    }
    callApi(`/api/users/${session.user.id}/rating`, "GET");
  }

  function getRatingOfOther() {
    const id = otherUserId.trim();
    if (!id) {
      setResult("Paste a user id in the user id box first.");
      return;
    }
    callApi(`/api/users/${id}/rating`, "GET");
  }

  function previewPromo() {
    const rideId = manualRideId.trim() || lastRideId;
    if (!rideId) {
      setResult("Paste a ride id in the box first.");
      return;
    }
    if (!promoCode.trim()) {
      setResult("Type a promo code first.");
      return;
    }
    callApi("/api/promos/preview", "POST", { ride_id: rideId, code: promoCode });
  }

  function createPaymentIntentWithPromo() {
    const rideId = manualRideId.trim() || lastRideId;
    if (!rideId) {
      setResult("Paste a ride id in the box first.");
      return;
    }
    if (!promoCode.trim()) {
      setResult("Type a promo code first.");
      return;
    }
    callApi(`/api/payments/rides/${rideId}/intent`, "POST", {
      promo_code: promoCode,
    });
  }

  function createTopup() {
    callApi("/api/wallet/topup", "POST", { amount: Number(topupAmount) });
  }

  function payWithWallet() {
    const rideId = manualRideId.trim() || lastRideId;
    if (!rideId) {
      setResult("Paste a ride id in the box first.");
      return;
    }
    const payload = promoCode.trim() ? { promo_code: promoCode } : undefined;
    callApi(`/api/payments/rides/${rideId}/pay-with-wallet`, "POST", payload);
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-2xl font-bold">Test protected API</h1>
      <div className="flex flex-wrap justify-center gap-3">
        <button
          onClick={() => callApi("/api/me", "GET")}
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET /api/me
        </button>
        <button
          onClick={() => callApi("/api/auth/session", "POST")}
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST /api/auth/session
        </button>
        <button
          onClick={() =>
            callApi(
              "/api/rides/estimate?origin_lat=51.5080&origin_lng=-0.1281&dest_lat=51.5055&dest_lng=-0.0754",
              "GET"
            )
          }
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET estimate
        </button>
        <button
          onClick={requestRide}
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST ride request
        </button>
        <button
          onClick={checkStatus}
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET ride status
        </button>
        <button
          onClick={matchRide}
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST match ride
        </button>
        <button
          onClick={checkUnknownRide}
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET unknown ride
        </button>
        <button
          onClick={() =>
            callApi("/api/drivers/register", "POST", {
              vehicle_info: "Toyota Etios, white, TEST-1234",
            })
          }
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST register driver
        </button>
        <button
          onClick={() =>
            callApi("/api/drivers/location", "PUT", {
              lat: 51.5074,
              lng: -0.1278,
            })
          }
          className="rounded bg-black px-4 py-2 text-white"
        >
          PUT driver location
        </button>
        <button
          onClick={() =>
            callApi("/api/drivers/status", "PUT", { status: "active" })
          }
          className="rounded bg-black px-4 py-2 text-white"
        >
          PUT go online
        </button>
        <button
          onClick={() =>
            callApi("/api/drivers/status", "PUT", { status: "offline" })
          }
          className="rounded bg-black px-4 py-2 text-white"
        >
          PUT go offline
        </button>
        <button
          onClick={() =>
            callApi(
              "/api/drivers/nearby?lat=51.5055&lng=-0.0754&radius_meters=5000",
              "GET"
            )
          }
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET nearby drivers
        </button>
                <button
          onClick={getCurrentRide}
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET current ride
        </button>
        <button
          onClick={startRide}
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST start ride
        </button>
                <button
          onClick={completeRide}
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST complete ride
        </button>
        <button
          onClick={cancelRide}
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST cancel ride
        </button>
                <input
          value={manualRideId}
          onChange={(e) => setManualRideId(e.target.value)}
          placeholder="Ride id (for payment)"
          className="rounded border p-2"
        />
        <button
          onClick={createPaymentIntent}
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST payment intent
        </button>
        <button
          onClick={getPaymentStatus}
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET payment status
        </button>
        <button
          onClick={getReceipt}
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET receipt
        </button>
        <button
          onClick={downloadReceiptPdf}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Download receipt PDF
        </button>
        <button
          onClick={emailReceipt}
          className="rounded bg-black px-4 py-2 text-white"
        >
          Email receipt
        </button>
        <button
          onClick={() => postReview(5, "")}
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST review (5 stars)
        </button>
        <button
          onClick={() => postReview(3, "  Fine ride, a bit slow.  ")}
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST review (3 + comment)
        </button>
        <select
          value={reviewRating}
          onChange={(e) => setReviewRating(e.target.value)}
          className="rounded border bg-transparent p-2"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n} className="text-black">
              {n} star{n > 1 ? "s" : ""}
            </option>
          ))}
        </select>
        <button
          onClick={() => postReview(Number(reviewRating), "")}
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST review (picked stars)
        </button>
        <button
          onClick={getMyRating}
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET my rating
        </button>
        <input
          value={otherUserId}
          onChange={(e) => setOtherUserId(e.target.value)}
          placeholder="Other user id"
          className="rounded border p-2"
        />
        <button
          onClick={getRatingOfOther}
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET rating of that user
        </button>
        <button
          onClick={() => callApi("/api/reviews/received?limit=5", "GET")}
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET reviews I received
        </button>
        <button
          onClick={() => callApi("/api/reviews/received?limit=1&offset=1", "GET")}
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET received (limit 1, offset 1)
        </button>
        <input
          value={promoCode}
          onChange={(e) => setPromoCode(e.target.value)}
          placeholder="Promo code"
          className="rounded border p-2"
        />
        <button
          onClick={previewPromo}
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST promo preview
        </button>
        <button
          onClick={createPaymentIntentWithPromo}
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST payment intent + promo
        </button>
        <button
          onClick={() => callApi("/api/wallet", "GET")}
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET wallet
        </button>
        <button
          onClick={() => callApi("/api/wallet/transactions?limit=5", "GET")}
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET wallet transactions
        </button>
        <input
          value={topupAmount}
          onChange={(e) => setTopupAmount(e.target.value)}
          placeholder="Top-up amount"
          className="w-32 rounded border p-2"
        />
        <button
          onClick={createTopup}
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST wallet top-up
        </button>
        <button
          onClick={payWithWallet}
          className="rounded bg-black px-4 py-2 text-white"
        >
          POST pay with wallet
        </button>
        <button
          onClick={() => callApi("/api/rides/history?role=rider&limit=5", "GET")}
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET history (rider)
        </button>
        <button
          onClick={() => callApi("/api/rides/history?role=driver&limit=5", "GET")}
          className="rounded bg-black px-4 py-2 text-white"
        >
          GET history (driver)
        </button>
        
      </div>
      <pre className="max-w-xl whitespace-pre-wrap break-words text-sm">
        {result}
      </pre>
    </main>
  );
}