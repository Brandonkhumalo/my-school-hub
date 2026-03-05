import React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function PaymentFailed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reference = searchParams.get("reference") || searchParams.get("Reference");
  const reason = searchParams.get("error") || searchParams.get("status");

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
        {/* Failure icon */}
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </div>

        <h1 className="text-2xl font-bold text-gray-800 mb-2">Payment Failed</h1>
        <p className="text-gray-600 mb-2">
          Your payment could not be completed. No money has been deducted from your account.
        </p>

        {reference && (
          <p className="text-sm text-gray-400 mb-2">
            Reference: <span className="font-mono font-medium">{reference}</span>
          </p>
        )}
        {reason && (
          <p className="text-sm text-red-500 mb-4">Reason: {reason}</p>
        )}

        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-left">
          <p className="text-sm text-red-800 font-medium">Common reasons for failure:</p>
          <ul className="text-xs text-red-700 mt-2 space-y-1 list-disc list-inside">
            <li>Insufficient EcoCash / OneMoney balance</li>
            <li>Wrong PIN entered</li>
            <li>Session timed out (too long to approve)</li>
            <li>Network or connectivity issue</li>
            <li>Payment cancelled by user</li>
          </ul>
        </div>

        <div className="flex gap-3 justify-center">
          <button onClick={() => navigate(-1)}
            className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700">
            Try Again
          </button>
          <button onClick={() => navigate("/")}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
            Go to Dashboard
          </button>
        </div>

        <p className="text-xs text-gray-400 mt-6">
          If money was deducted but payment shows as failed, please contact your school finance office with your reference number.
        </p>
      </div>
    </div>
  );
}
