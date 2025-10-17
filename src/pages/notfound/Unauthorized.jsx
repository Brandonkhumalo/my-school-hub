import React from "react";
import { Link } from "react-router-dom";

export default function Unauthorized() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <h1 className="text-6xl font-bold text-red-600 mb-4">403</h1>
      <p className="text-xl text-gray-600 mb-8">You are not authorized to access this page</p>
      <Link to="/" className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-md">
        Go Back
      </Link>
    </div>
  );
}
