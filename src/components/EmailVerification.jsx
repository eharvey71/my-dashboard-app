import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { verifyEmail, resendVerificationEmail } from '../services/firebaseAuth';

const EmailVerification = () => {
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const queryParams = new URLSearchParams(location.search);
    const actionCode = queryParams.get('oobCode');

    if (actionCode) {
      setVerifying(true);
      verifyEmail(actionCode).then((result) => {
        if (result.success) {
          setSuccess(true);
          setTimeout(() => navigate('/login'), 3000);
        } else {
          setError(result.error);
        }
        setVerifying(false);
      });
    }
  }, [location, navigate]);

  useEffect(() => {
    let timer;
    if (resendCooldown > 0) {
      timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
    }
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;

    const result = await resendVerificationEmail();
    if (result.success) {
      setSuccess(true);
      setError(null);
      setResendCooldown(60); // Set a 60-second cooldown
    } else {
      setError(result.error);
    }
  };

  if (verifying) {
    return <div>Verifying your email...</div>;
  }

  if (success) {
    return (
      <div>
        <h2>Email Verified Successfully!</h2>
        <p>Your email has been verified. You will be redirected to the login page shortly.</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Email Verification Required</h2>
      <p>Please check your email and click on the verification link to complete the signup process.</p>
      <button 
        onClick={handleResendVerification} 
        disabled={resendCooldown > 0}
      >
        {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend Verification Email'}
      </button>
      {error && <p style={{color: 'red'}}>{error}</p>}
    </div>
  );
};

export default EmailVerification;