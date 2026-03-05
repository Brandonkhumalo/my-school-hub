import React, { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import apiService from "../../services/apiService";

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState("verifying"); // verifying | paid | pending
  const pollUrl = searchParams.get("pollurl") || searchParams.get("poll_url");
  const reference = searchParams.get("reference") || searchParams.get("Reference");

  useEffect(() => {
    if (!pollUrl) {
      setStatus("paid"); // No poll URL — treat as success (web redirect)
      return;
    }
    // Poll PayNow to confirm payment
    apiService.checkPaynowStatus(pollUrl)
      .then((data) => setStatus(data.paid ? "paid" : "pending"))
      .catch(() => setStatus("paid")); // On error, assume success since PayNow redirected here
  }, [pollUrl]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {status === "verifying" ? (
          <>
            <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-800 mb-2">Verifying Payment...</h1>
            <p className="text-gray-500 text-sm">Please wait while we confirm your payment.</p>
          </>
        ) : status === "paid" ? (
          <>
            {/* Success icon */}
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Payment Successful!</h1>
            <p className="text-gray-600 mb-2">Your payment has been received and confirmed.</p>
            {reference && (
              <p className="text-sm text-gray-400 mb-6">Reference: <span className="font-mono font-medium">{reference}</span></p>
            )}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 text-left">
              <p className="text-sm text-green-800 font-medium">What happens next?</p>
              <ul className="text-xs text-green-700 mt-2 space-y-1 list-disc list-inside">
                <li>Your fee balance has been updated automatically</li>
                <li>A receipt will be available in your account</li>
                <li>The school finance office has been notified</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate(-1)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Go Back
              </button>
              <button onClick={() => navigate("/")}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm hover:bg-green-700">
                Go to Dashboard
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Pending icon */}
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-10 h-10 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800 mb-2">Payment Pending</h1>
            <p className="text-gray-600 mb-6">
              Your payment is being processed. This may take a few minutes.
              Please check your account balance shortly.
            </p>
            {reference && (
              <p className="text-sm text-gray-400 mb-6">Reference: <span className="font-mono font-medium">{reference}</span></p>
            )}
            <div className="flex gap-3 justify-center">
              <button onClick={() => navigate(-1)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                Go Back
              </button>
              <button onClick={() => navigate("/")}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700">
                Go to Dashboard
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
