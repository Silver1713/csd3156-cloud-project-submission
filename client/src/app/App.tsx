import { useEffect, useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";

import AppLayout from "../layouts/AppLayout";
import AuthPage from "../pages/auth/AuthPage";
import "../pages/auth/auth-page.css";
import {
  cacheResolvedAccount,
  clearStoredCognitoSession,
  type BackendAuthAccount,
  getCognitoStatus,
  getStoredResolvedAccount,
  isCognitoConfigured,
  loginWithCognito,
  refreshStoredCognitoSession,
  registerWithCognito,
  resolveCognitoSession,
  resolveStoredCognitoSession,
  restoreStoredAuthSession,
  signOutOfCognito,
} from "../services/auth.service";

type AuthViewState = "booting" | "authenticated" | "unauthenticated";

function AuthBootScreen() {
  return (
    <main className="auth-page auth-page--boot">
      <section className="auth-boot-modal" role="status" aria-live="polite">
        <div className="auth-boot-modal__brand">
          <div className="auth-hero-brand-mark">IL</div>
          <div>
            <p className="auth-hero-brand-title">Indigo Ledger</p>
            <p className="auth-hero-brand-subtitle">Cloud-Based Inventory Control</p>
          </div>
        </div>

        <div className="auth-boot-modal__loader" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>

        <div className="auth-boot-modal__copy">
          <strong>Restoring your session</strong>
          <p>Verifying stored credentials and refreshing access when needed.</p>
        </div>
      </section>
    </main>
  );
}

type AuthPageRouteProps = {
  mode: "login" | "register";
  statusMessage: string;
  authError: string | null;
  userEmail: string;
  backendLinked: boolean;
  onSignIn: (payload: { username: string; password: string }) => Promise<string>;
  onRegister: (payload: {
    joinKey: string;
    email: string;
    username: string;
    password: string;
  }) => Promise<string>;
  onSignOut: () => void;
};

function AuthPageRoute({
  mode,
  statusMessage,
  authError,
  userEmail,
  backendLinked,
  onSignIn,
  onRegister,
  onSignOut,
}: AuthPageRouteProps) {
  const navigate = useNavigate();

  return (
    <AuthPage
      cognitoEnabled={isCognitoConfigured()}
      initialMode={mode}
      authLoading={false}
      authError={authError}
      isAuthenticated={false}
      userEmail={userEmail}
      backendLinked={backendLinked}
      initialMessage={statusMessage}
      onModeChange={(nextMode) => {
        navigate(nextMode === "register" ? "/register" : "/login", { replace: true });
      }}
      onSignIn={onSignIn}
      onRegister={onRegister}
      onSignOut={onSignOut}
    />
  );
}

function AppRoutes() {
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [authError, setAuthError] = useState<string | null>(null);
  const [authViewState, setAuthViewState] = useState<AuthViewState>("booting");
  const [userEmail, setUserEmail] = useState<string>("");
  const [backendLinked, setBackendLinked] = useState<boolean>(false);
  const [backendAccount, setBackendAccount] = useState<BackendAuthAccount | null>(null);
  const location = useLocation();

  function handleAccountUpdate(account: BackendAuthAccount | null): void {
    setBackendAccount(account);

    if (account) {
      cacheResolvedAccount(account);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadAuthState() {
      try {
        const status = await getCognitoStatus();
        const session = await restoreStoredAuthSession();

        if (cancelled) {
          return;
        }

        setStatusMessage(status.message);
        setBackendAccount(getStoredResolvedAccount());

        if (session) {
          try {
            const resolvedSession = await resolveStoredCognitoSession();

            if (cancelled) {
              return;
            }

            setAuthViewState("authenticated");
            setUserEmail(session.email || session.username);
            setBackendLinked(true);
            handleAccountUpdate(resolvedSession.account);
            setStatusMessage(
              resolvedSession.provisioned
                ? "Restored your Cognito session and provisioned the backend account state."
                : "Restored your Cognito session from local browser storage.",
            );
            return;
          } catch {
            const refreshedSession = await refreshStoredCognitoSession();
            const resolvedSession = await resolveCognitoSession(
              refreshedSession.tokens.accessToken,
              refreshedSession.tokens.idToken,
            );

            if (cancelled) {
              return;
            }

            setAuthViewState("authenticated");
            setUserEmail(
              refreshedSession.profile.email || refreshedSession.profile.username,
            );
            setBackendLinked(true);
            handleAccountUpdate(resolvedSession.account);
            setStatusMessage(
              "Restored your session with a refreshed Cognito access token.",
            );
            return;
          }
        }

        setAuthViewState("unauthenticated");
      } catch (error) {
        if (!cancelled) {
          clearStoredCognitoSession();
          setAuthError(
            error instanceof Error ? error.message : "Failed to restore Cognito session",
          );
          setAuthViewState("unauthenticated");
        }
      }
    }

    void loadAuthState();

    return () => {
      cancelled = true;
    };
  }, []);

  if (authViewState === "booting") {
    return <AuthBootScreen />;
  }

  const signIn = async ({ username, password }: { username: string; password: string }) => {
    setAuthError(null);
    setBackendLinked(false);

    const session = await loginWithCognito({ username, password });
    const resolvedSession = await resolveCognitoSession(
      session.tokens.accessToken,
      session.tokens.idToken,
    );

    setAuthViewState("authenticated");
    setUserEmail(session.profile.email || session.profile.username);
    setBackendLinked(true);
    handleAccountUpdate(resolvedSession.account);

    return resolvedSession.provisioned
      ? `Signed in with Cognito as ${session.profile.email || session.profile.username}. The backend created and linked your local account.`
      : `Signed in with Cognito as ${session.profile.email || session.profile.username}. The backend resolved your existing local account.`;
  };

  const register = async ({
    joinKey,
    email,
    username,
    password,
  }: {
    joinKey: string;
    email: string;
    username: string;
    password: string;
  }) => {
    setAuthError(null);
    const result = await registerWithCognito({
      joinKey,
      email,
      username,
      password,
    });
    return result.userConfirmed
      ? `Created Cognito account for ${result.username}.`
      : `Created Cognito account for ${result.username}. Check ${result.email} to confirm it before sign-in. Your join key will be used the first time the account is resolved.`;
  };

  const signOut = () => {
    signOutOfCognito();
    setAuthViewState("unauthenticated");
    setBackendLinked(false);
    handleAccountUpdate(null);
    setUserEmail("");
    setAuthError(null);
    setStatusMessage("Signed out and cleared local Cognito tokens.");
  };

  return (
    <Routes>
      <Route
        path="/"
        element={
          <Navigate
            to={authViewState === "authenticated" ? "/app" : "/login"}
            replace
          />
        }
      />
      <Route
        path="/login"
        element={
          authViewState === "authenticated" ? (
            <Navigate to="/app" replace />
          ) : (
            <AuthPageRoute
              mode="login"
              statusMessage={statusMessage}
              authError={authError}
              userEmail={userEmail}
              backendLinked={backendLinked}
              onSignIn={signIn}
              onRegister={register}
              onSignOut={signOut}
            />
          )
        }
      />
      <Route
        path="/register"
        element={
          authViewState === "authenticated" ? (
            <Navigate to="/app" replace />
          ) : (
            <AuthPageRoute
              mode="register"
              statusMessage={statusMessage}
              authError={authError}
              userEmail={userEmail}
              backendLinked={backendLinked}
              onSignIn={signIn}
              onRegister={register}
              onSignOut={signOut}
            />
          )
        }
      />
      <Route
        path="/app"
        element={
          authViewState === "authenticated" ? (
            <AppLayout
              account={backendAccount}
              userEmail={userEmail}
              onSignOut={signOut}
              onAccountUpdate={handleAccountUpdate}
            />
          ) : (
            <Navigate to="/login" replace state={{ from: location }} />
          )
        }
      />
      <Route
        path="*"
        element={<Navigate to={authViewState === "authenticated" ? "/app" : "/login"} replace />}
      />
    </Routes>
  );
}

export default function App() {
  return <AppRoutes />;
}
