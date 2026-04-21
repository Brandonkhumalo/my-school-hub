import React, { createContext, useContext, useState } from 'react';

const TwoFactorContext = createContext();

export function TwoFactorProvider({ children }) {
  const [otpSessionToken, setOtpSessionToken] = useState(null);
  const [pendingUserData, setPendingUserData] = useState(null); // { username, password } for display only

  const startOtpFlow = (token) => setOtpSessionToken(token);
  const clearOtpFlow = () => { setOtpSessionToken(null); setPendingUserData(null); };

  return (
    <TwoFactorContext.Provider value={{ otpSessionToken, pendingUserData, setPendingUserData, startOtpFlow, clearOtpFlow }}>
      {children}
    </TwoFactorContext.Provider>
  );
}

export function useTwoFactor() {
  return useContext(TwoFactorContext);
}
