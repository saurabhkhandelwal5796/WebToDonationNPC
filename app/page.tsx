'use client';

import { useState, FormEvent, useEffect, useRef, useCallback } from 'react';

// ─── Session Management ────────────────────────────────────────────────────────
// Generate a unique session ID on first visit and reuse it on every page refresh
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
// Reusable function to log a visitor journey event.
// Routes through our Next.js backend (/api/activity) which handles OAuth +
// Salesforce call — this avoids browser CORS restrictions.
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

    // Fire-and-forget: do not await so tracking never blocks the UI
    fetch('/api/activity', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch((err) => console.warn('Activity tracking failed silently:', err));

  } catch (err) {
    console.warn('Activity tracking error:', err);
  }
}
// ──────────────────────────────────────────────────────────────────────────────

export default function Home() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [amount, setAmount] = useState('');

  // Response state
  const [sfRecords, setSfRecords] = useState({
    accountId: '',
    giftCommitmentId: '',
    giftTransactionId: ''
  });

  // ─── Tracking Refs (fire-once guards) ─────────────────────────────────────
  const donationSectionViewedFired = useRef(false);
  const donationStartedFired = useRef(false);
  const donationSectionRef = useRef<HTMLElement>(null);

  // ─── Event 1: Page Viewed ─────────────────────────────────────────────────
  // Fire once automatically when the page first loads. Status = Anonymous
  useEffect(() => {
    logWebsiteActivity('Page Viewed', 'Anonymous');
  }, []);

  // ─── Event 2: Donation Section Viewed ─────────────────────────────────────
  // Fire once when the donation form first enters the user's viewport. Status = Interested
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

  // ─── Event 3: Donation Started ────────────────────────────────────────────
  // Fire once when the visitor first focuses on any donation form field. Status = Interested
  const handleFormFocus = useCallback(() => {
    if (!donationStartedFired.current) {
      donationStartedFired.current = true;
      logWebsiteActivity('Donation Started', 'Interested');
    }
  }, []);

  // ─── Event 4: Donation Submitted ─────────────────────────────────────────
  // Fire immediately before calling the existing Salesforce donation API. Status = Processing
  // NOTE: "Donation Completed" is NOT fired here — the Apex Donation REST API
  // already creates that Website Activity record server-side.
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    const sessionId = getOrCreateSessionId();

    // Event 4: Fire before the donation API call
    logWebsiteActivity('Donation Submitted', 'Processing', email, Number(amount));

    try {
      // Include sessionId in the donation payload so Apex can link all records
      const payload = {
        firstName,
        lastName,
        email,
        phone,
        amount: Number(amount),
        sessionId,
      };

      const response = await fetch('/api/donate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        
        // Auto-redirect back to home (reset form and scroll to top) after 4 seconds
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
        throw new Error(data.message || "Unable to process donation. Please try again.");
      }
    } catch (error: any) {
      console.error("Donation Error:", error);
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
            {/* <li><a href="#">Programs</a></li> */}
            {/* <li><a href="#">Impact</a></li> */}
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

      {/* ref used to detect when this section enters the viewport */}
      <section id="donate" className="donation-section" ref={donationSectionRef}>
        
        {/* Form Container */}
        {(status === 'idle' || status === 'loading') && (
          <div className="donation-card" id="donationFormContainer">
            <h2>Make Your Contribution Today</h2>
            {/* onFocus on the <form> captures the first interaction on any child field */}
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
