import React, { useState } from 'react';
import { Mail, Lock, ArrowRight, UtensilsCrossed, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const Login: React.FC<{ customError?: string | null }> = ({ customError }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (authError) throw authError;
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
           <div className="login-logo-icon">
              <UtensilsCrossed size={20} color="#fff" />
           </div>
           <h2>KIOSK-DASHBOARD</h2>
           <p>Enterprise Management System</p>
        </div>
        
        {(error || customError) && <div className="login-error">{error || customError}</div>}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group-login">
            <label>EMAIL ADDRESS</label>
            <div className="input-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                placeholder="chef@culinary.os"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group-login">
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
               <label>PASSWORD</label>
               <a href="#" className="forgot-password">Forgot Password?</a>
            </div>
            <div className="input-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="checkbox-wrapper">
            <input type="checkbox" id="keep-signed-in" />
            <label htmlFor="keep-signed-in">Keep me signed in</label>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <>
                Sign In to Dashboard <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>
        
        <div className="login-footer-text">
           Protected by high-precision encryption standards.
        </div>
      </div>
      
      <div className="login-page-footer">
         <div className="footer-links">
            <a href="#">Security Policy</a>
            <a href="#">Terms of Service</a>
            <a href="#">Support</a>
         </div>
         <p>© 2024 CULINARY PRECISION SYSTEMS. ALL RIGHTS RESERVED.</p>
      </div>
    </div>
  );
};
