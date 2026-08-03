'use client';

import { useState, FormEvent, useEffect, useRef, useCallback } from 'react';

// ─── Session Management ────────────────────────────────────────────────────────
function getOrCreateSessionId(): string {
  const key = 'aif_session_id';
  let sessionId = localStorage.getItem(key);
  if (!sessionId) {
    sessionId = `sess_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    localStorage.setItem(key, sessionId);
  }
  return sessionId;
}

// ─── Website Activity Tracker ──────────────────────────────────────────────────
async function logWebsiteActivity(
  eventName: string,
  status: string,
  email: string = '',
  donationAmount: number | null = null
): Promise<void> {
  try {
    const sessionId = getOrCreateSessionId();

    const body: Record<string, unknown> = {
      sessionId,
      eventName,
      status,
      pageUrl: window.location.href,
    };
    if (email) body.email = email;
    if (donationAmount !== null) body.donationAmount = donationAmount;

    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch((err) => console.warn('Activity tracking failed silently:', err));

  } catch (err) {
    console.warn('Activity tracking error:', err);
  }
}

export default function Home() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');

  const [sfRecords, setSfRecords] = useState({
    accountId: '',
    giftCommitmentId: '',
    giftTransactionId: ''
  });

  // ─── Tracking Refs ─────────────────────────────────────────────────────────
  const donationSectionViewedFired = useRef(false);
  const donationStartedFired = useRef(false);
  const donationSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    logWebsiteActivity('Page Viewed', 'Anonymous');
  }, []);

  useEffect(() => {
    const sectionEl = donationSectionRef.current;
    if (!sectionEl) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !donationSectionViewedFired.current) {
          donationSectionViewedFired.current = true;
          logWebsiteActivity('Donation Section Viewed', 'Interested');
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(sectionEl);
    return () => observer.disconnect();
  }, []);

  const handleFormFocus = useCallback(() => {
    if (!donationStartedFired.current) {
      donationStartedFired.current = true;
      logWebsiteActivity('Donation Started', 'Interested');
    }
  }, []);

  // ─── Razorpay + Salesforce Checkout Flow ───────────────────────────────────
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const parsedAmount = Number(amount);
    
    // Strict amount validation before proceeding
    if (!amount || isNaN(parsedAmount) || parsedAmount <= 0) {
      setStatus('error');
      setErrorMessage("Please enter a valid donation amount.");
      return;
    }

    setStatus('loading');

    const sessionId = getOrCreateSessionId();

    // Event 4: Fire before the payment/donation API call
    logWebsiteActivity('Donation Submitted', 'Processing', email, parsedAmount);

    try {
      const orderPayload = { amount: parsedAmount };
      console.log("Sending Razorpay payload:", orderPayload);

      // 1. Create Razorpay Order on Backend
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload)
      });
      const orderData = await orderRes.json();
      
      if (!orderRes.ok || !orderData.success) {
        throw new Error(orderData.message || "Failed to initialize payment gateway.");
      }

      // 2. Open Razorpay Checkout Popup
      const options = {
        key: orderData.keyId,
        amount: Math.round(parsedAmount * 100),
        currency: "USD",
        name: "America India Foundation",
        description: "Donation",
        order_id: orderData.orderId,
        handler: async function (response: any) {
          // PAYMENT SUCCESSFUL -> Call Salesforce
          setStatus('loading'); // Show loading again while calling SF
          try {
            const payload = {
              firstName,
              lastName,
              email,
              phone,
              amount: parsedAmount,
              sessionId,
            };

            const sfResponse = await fetch('/api/donate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });

            const data = await sfResponse.json();

            if (sfResponse.ok && data.success) {
              setStatus('success');
              
              // Auto-redirect back to home
              setTimeout(() => {
                resetForm();
                setFirstName('');
                setLastName('');
                setEmail('');
                setPhone('');
                setAmount('');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }, 4000);
            } else {
              throw new Error("Payment was successful, but we failed to record it in our system.");
            }
          } catch (error: any) {
             console.error("Salesforce Error after payment:", error);
             setStatus('error');
             setErrorMessage("Payment was successful, but we failed to record it in our system.");
          }
        },
        prefill: {
          name: `${firstName} ${lastName}`,
          email: email,
          contact: phone
        },
        theme: {
          color: "var(--primary-blue)"
        },
        modal: {
          ondismiss: function() {
            // PAYMENT CANCELLED -> Do not call SF
            setStatus('error');
            setErrorMessage("Payment was cancelled or failed.");
          }
        }
      };
      
      const rzp = new (window as any).Razorpay(options);
      
      rzp.on('payment.failed', function (response: any) {
         setStatus('error');
         setErrorMessage("Payment was cancelled or failed.");
      });
      
      rzp.open();

    } catch (error: any) {
      console.error("Checkout Error:", error);
      setStatus('error');
      setErrorMessage(error.message || "Unable to process donation. Please try again.");
    }
  };

  const resetForm = () => {
    setStatus('idle');
    setErrorMessage('');
  };

  return (
    <>
      <header>
        <a href="#" className="logo">America India Foundation</a>
        <nav>
          <ul>
            <li><a href="#">Our Mission</a></li>
            <li><a href="#donate" style={{ color: 'var(--primary-green)', fontWeight: 600 }}>Donate</a></li>
          </ul>
        </nav>
      </header>

      <section className="hero">
        <h1>Together, We Can Create Lasting Impact</h1>
        <p>Support programs that empower communities through education, healthcare, and sustainable livelihoods.</p>
        
        <div className="impact-container">
          <div className="impact-card">
            <h3>Education</h3>
            <p>Creating learning opportunities for children and youth</p>
          </div>
          <div className="impact-card">
            <h3>Healthcare</h3>
            <p>Improving access to healthcare for communities</p>
          </div>
          <div className="impact-card">
            <h3>Livelihoods</h3>
            <p>Building sustainable opportunities for families</p>
          </div>
        </div>
      </section>

      <section id="donate" className="donation-section" ref={donationSectionRef}>
        
        {/* Form Container */}
        {(status === 'idle' || status === 'loading') && (
          <div className="donation-card" id="donationFormContainer">
            <h2>Make Your Contribution Today</h2>
            <form id="donationForm" onSubmit={handleSubmit} onFocus={handleFormFocus}>
              <div className="form-group">
                <label htmlFor="firstName">First Name *</label>
                <input 
                  type="text" 
                  id="firstName" 
                  className="form-control" 
                  required 
                  placeholder="First Name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="lastName">Last Name *</label>
                <input 
                  type="text" 
                  id="lastName" 
                  className="form-control" 
                  required 
                  placeholder="Last Name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input 
                  type="email" 
                  id="email" 
                  className="form-control" 
                  required 
                  placeholder="email@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="phone">Phone Number *</label>
                <input 
                  type="tel" 
                  id="phone" 
                  className="form-control" 
                  required 
                  placeholder="Phone Number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="amount">Donation Amount *</label>
                <div className="amount-input-wrapper">
                  <span>$</span>
                  <input 
                    type="number" 
                    id="amount" 
                    className="form-control" 
                    required 
                    min="1" 
                    step="any" 
                    placeholder="Amount"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </div>
              </div>
              <button 
                type="submit" 
                id="submitBtn" 
                className="btn-donate"
                disabled={status === 'loading'}
              >
                {status === 'loading' ? 'Processing Donation...' : 'Donate Now'}
              </button>
            </form>
          </div>
        )}

        {/* Success Container */}
        {status === 'success' && (
          <div className="donation-card message-box success-box" id="successContainer" style={{ display: 'block' }}>
            <h2>Thank You For Making A Difference!</h2>
            <p>Your donation has been successfully recorded. We are redirecting you back to the home page...</p>
          </div>
        )}

        {/* Error Container */}
        {status === 'error' && (
          <div className="donation-card message-box error-box" id="errorContainer" style={{ display: 'block' }}>
            <h2>Transaction Failed</h2>
            <p id="errorMessage">{errorMessage}</p>
            <button className="btn-donate" onClick={resetForm} style={{ marginTop: '2rem' }}>
              Try Again
            </button>
          </div>
        )}

      </section>

      <footer>
        <p>Powered by Salesforce Nonprofit Cloud Demo</p>
      </footer>
    </>
  );
}
