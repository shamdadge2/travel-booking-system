import { useEffect, useRef } from "react";
import useAuth from "../hooks/useAuth";

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/**
 * Renders Google's own "Sign in with Google" button using the Google
 * Identity Services script loaded in index.html. On success it hands
 * the ID token to AuthContext.loginWithGoogle, which sends it to our
 * backend for verification — this component never decides who the
 * user is itself, it just relays what Google's button produced.
 */
export default function GoogleLoginButton({ onSuccess, onError }) {
  const { loginWithGoogle } = useAuth();
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return;

    let cancelled = false;

    const handleCredentialResponse = async (response) => {
      const result = await loginWithGoogle(response.credential);
      if (cancelled) return;
      if (result.success) {
        onSuccess?.();
      } else if (onError) {
        onError(result.error);
      }
    };

    const renderButton = () => {
      if (cancelled || !window.google?.accounts?.id || !buttonRef.current) return;
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredentialResponse,
      });
      window.google.accounts.id.renderButton(buttonRef.current, {
        type: "standard",
        theme: "outline",
        size: "large",
        width: 320,
      });
    };

    // The GSI script loads with `defer`, so it may not be ready the
    // instant this component mounts — poll briefly until it is.
    if (window.google?.accounts?.id) {
      renderButton();
    } else {
      const interval = setInterval(() => {
        if (window.google?.accounts?.id) {
          clearInterval(interval);
          renderButton();
        }
      }, 100);
      return () => {
        cancelled = true;
        clearInterval(interval);
      };
    }

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!GOOGLE_CLIENT_ID) {
    return null; // Cleanly hide the button rather than render something broken.
  }

  return <div ref={buttonRef} />;
}
