import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * PlaygroundPage has been consolidated into GovernancePage (/governance).
 * Redirects visitors directly to /governance.
 */
export function PlaygroundPage() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/governance', { replace: true });
  }, [navigate]);

  return null;
}
