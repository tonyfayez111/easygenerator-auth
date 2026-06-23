import { useEffect, useRef } from 'react';
import { useAuth } from '../../../context/useAuth';
import { authApi } from '../api/authApi';

const SLIDING_SESSION_INTERVAL = 5 * 60 * 1000;
const ACTIVITY_TIMEOUT = 2 * 60 * 1000;

export function useSlidingSession() {
  const { accessToken } = useAuth();
  const lastActivityTime = useRef<number>(0);

  useEffect(() => {
    lastActivityTime.current = Date.now();

    const handleActivity = () => {
      lastActivityTime.current = Date.now();
    };

    const events = ['mousedown', 'keydown', 'touchstart', 'click'];
    events.forEach((event) => window.addEventListener(event, handleActivity));
    return () => events.forEach((event) => window.removeEventListener(event, handleActivity));
  }, []);

  useEffect(() => {
    if (!accessToken) return;

    const id = setInterval(async () => {
      const inactive = Date.now() - lastActivityTime.current > ACTIVITY_TIMEOUT;
      if (inactive) return;

      try {
        await authApi.refreshToken();
      } catch {
        // silent — user will be redirected on the next authenticated API call
      }
    }, SLIDING_SESSION_INTERVAL);

    return () => clearInterval(id);
  }, [accessToken]);
}
