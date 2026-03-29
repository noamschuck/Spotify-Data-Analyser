import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { exchangeCode } from '../spotify/auth';
import { LoadingSpinner } from '../components/LoadingSpinner';

export function Callback() {
  const navigate = useNavigate();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error || !code) {
      navigate('/?error=auth_denied');
      return;
    }

    exchangeCode(code)
      .then(() => { window.location.href = '/dashboard'; })
      .catch(() => navigate('/?error=token_exchange'));
  }, [navigate]);

  return <LoadingSpinner message="Connecting to Spotify..." />;
}
