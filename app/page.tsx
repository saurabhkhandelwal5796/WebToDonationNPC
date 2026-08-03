'use client';

import { useState, FormEvent } from 'react';

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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setStatus('loading');

    try {
      const payload = {
        firstName,
        lastName,
        email,
        phone,
        amount: Number(amount)
      };

      const response = await fetch('/api/donate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setStatus('success');
        setSfRecords({
          accountId: data.accountId || 'N/A',
          giftCommitmentId: data.giftCommitmentId || 'N/A',
          giftTransactionId: data.giftTransactionId || 'N/A'
        });
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

      <section id="donate" className="donation-section">
        
        {/* Form Container */}
        {(status === 'idle' || status === 'loading') && (
          <div className="donation-card" id="donationFormContainer">
            <h2>Make Your Contribution Today</h2>
            <form id="donationForm" onSubmit={handleSubmit}>
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
            <p>Donation successfully recorded.</p>
            <div className="record-details">
              <p><strong>Salesforce Records Created:</strong></p>
              <p>Person Account: <span id="resAccountId">{sfRecords.accountId}</span></p>
              <p>Gift Commitment: <span id="resGiftCommitmentId">{sfRecords.giftCommitmentId}</span></p>
              <p>Gift Transaction: <span id="resGiftTransactionId">{sfRecords.giftTransactionId}</span></p>
            </div>
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
