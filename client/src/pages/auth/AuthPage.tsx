import { useEffect, useState, type FormEvent } from "react";

import "./auth-page.css";

type AuthPageProps = {
  cognitoEnabled: boolean;
  initialMessage?: string;
  initialMode?: AuthMode;
  authLoading?: boolean;
  authError?: string | null;
  isAuthenticated?: boolean;
  userEmail?: string;
  backendLinked?: boolean;
  onSignIn?: (payload: LoginFormState) => Promise<string>;
  onRegister?: (payload: {
    joinKey: string;
    email: string;
    username: string;
    password: string;
  }) => Promise<string>;
  onSignOut?: () => void;
  onModeChange?: (mode: AuthMode) => void;
};

type AuthMode = "login" | "register";

type LoginFormState = {
  username: string;
  password: string;
};

type RegisterFormState = {
  joinKey: string;
  email: string;
  username: string;
  password: string;
  confirmPassword: string;
};

const initialLoginForm: LoginFormState = {
  username: "",
  password: "",
};

const initialRegisterForm: RegisterFormState = {
  joinKey: "",
  email: "",
  username: "",
  password: "",
  confirmPassword: "",
};

export default function AuthPage({
  cognitoEnabled,
  initialMessage = "",
  initialMode = "login",
  authLoading = false,
  authError = null,
  isAuthenticated = false,
  userEmail = "",
  backendLinked = false,
  onSignIn,
  onRegister,
  onSignOut,
  onModeChange,
}: AuthPageProps) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [loginForm, setLoginForm] = useState<LoginFormState>(initialLoginForm);
  const [registerForm, setRegisterForm] =
    useState<RegisterFormState>(initialRegisterForm);
  const [message, setMessage] = useState<string>(initialMessage);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const passwordsMismatch =
    registerForm.confirmPassword.length > 0 &&
    registerForm.password !== registerForm.confirmPassword;

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    onModeChange?.(nextMode);
  }

  async function handleLoginSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (cognitoEnabled && onSignIn) {
      try {
        setIsSubmitting(true);
        const nextMessage = await onSignIn(loginForm);
        setMessage(nextMessage);
      } catch (error) {
        setMessage(
          error instanceof Error ? error.message : "Cognito login request failed.",
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setMessage(`Login request prepared for ${loginForm.username || "this user"}.`);
  }

  async function handleRegisterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    if (registerForm.password !== registerForm.confirmPassword) {
      setMessage("Registration blocked: passwords do not match.");
      return;
    }

    if (cognitoEnabled && onRegister) {
        try {
          setIsSubmitting(true);
          const nextMessage = await onRegister({
            joinKey: registerForm.joinKey,
            email: registerForm.email,
            username: registerForm.username,
            password: registerForm.password,
        });
        setMessage(nextMessage);
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Cognito registration request failed.",
        );
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    setMessage(
      `Registration request prepared for ${registerForm.username || "new account"} with ${registerForm.joinKey || "no join key"}.`,
    );
  }

  return (
    <main className="auth-page">
      <div className="auth-shell">
        <section className="auth-hero" aria-label="Platform introduction">
          <div className="auth-hero-overlay" />
          <div className="auth-hero-brand">
            <div className="auth-hero-brand-mark">IL</div>
            <div>
              <p className="auth-hero-brand-title">Indigo Ledger</p>
              <p className="auth-hero-brand-subtitle">Cloud-Based Inventory Control</p>
            </div>
          </div>

          <div className="auth-hero-copy">
            <h1>
              Precision control for <span>inventory operations</span>.
            </h1>
            <p>
              Manage products, stock movement, inventory balances, and alerts in one operational workspace.
            </p>
          </div>

          <div className="auth-hero-panel">
            <div className="auth-hero-stat">
              <strong>Organization-first setup</strong>
              <p>
                Sign in once, then work inside the organization and role assigned to your account.
              </p>
            </div>
            <div className="auth-hero-points">
              <div>
                <strong>Product workflows</strong>
                <span>Create, update, and organize your product catalog</span>
              </div>
              <div>
                <strong>Movement history</strong>
                <span>Track stock-in, stock-out, and adjustment activity</span>
              </div>
              <div>
                <strong>Secure access</strong>
                <span>Protected sessions with role-based workspace access</span>
              </div>
            </div>
          </div>
        </section>

        <section className="auth-panel">
          {authLoading ? (
            <p className="auth-message" role="status" aria-live="polite">
              Checking your session...
            </p>
          ) : null}

          {authError ? (
            <p className="auth-error-banner" role="alert">
              Authentication error: {authError}
            </p>
          ) : null}

          {isAuthenticated ? (
            <section className="auth-signed-in" aria-labelledby="signed-in-title">
              <h2 id="signed-in-title">Signed in</h2>
              <p className="auth-form-copy">
                You are authenticated{userEmail ? ` as ${userEmail}` : ""}.
              </p>
              <p className="auth-form-copy">
                Backend link: {backendLinked ? "verified" : "not linked yet"}.
              </p>
              <div className="auth-actions">
                <button type="button" className="auth-submit" onClick={onSignOut}>
                  Sign Out
                </button>
              </div>
            </section>
          ) : (
            <>
              <div className="auth-tabs" role="tablist" aria-label="Authentication forms">
                <button
                  type="button"
                  className={mode === "login" ? "auth-tab is-active" : "auth-tab"}
                  id="tab-login"
                  role="tab"
                  aria-selected={mode === "login"}
                  aria-controls="panel-login"
                  tabIndex={mode === "login" ? 0 : -1}
                  onClick={() => switchMode("login")}
                >
                  Sign In
                </button>
                <button
                  type="button"
                  className={mode === "register" ? "auth-tab is-active" : "auth-tab"}
                  id="tab-register"
                  role="tab"
                  aria-selected={mode === "register"}
                  aria-controls="panel-register"
                  tabIndex={mode === "register" ? 0 : -1}
                  onClick={() => switchMode("register")}
                >
                  Register
                </button>
              </div>

              {mode === "login" ? (
                <form
                  className="auth-form"
                  id="panel-login"
                  method="post"
                  role="tabpanel"
                  aria-labelledby="tab-login"
                  onSubmit={handleLoginSubmit}
                >
                  <header className="auth-form-header">
                    <h2>Welcome back</h2>
                    <p className="auth-form-copy" id="login-help">
                      Sign in with your account credentials.
                    </p>
                  </header>

                  <div className="auth-field-group">
                    <label htmlFor="login-username">Email or Username</label>
                    <input
                      id="login-username"
                      name="username"
                      type="text"
                      placeholder="name@company.com"
                      autoComplete="username"
                      aria-describedby="login-help"
                      required
                      disabled={isSubmitting}
                      value={loginForm.username}
                      onChange={(event) =>
                        setLoginForm((current) => ({
                          ...current,
                          username: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <div className="auth-field-group">
                    <div className="auth-inline-label">
                      <label htmlFor="login-password">Password</label>
                      <button type="button" className="auth-link-button">
                        Forgot Password?
                      </button>
                    </div>
                    <input
                      id="login-password"
                      name="password"
                      type="password"
                      placeholder="••••••••"
                      autoComplete="current-password"
                      aria-describedby="login-help"
                      required
                      disabled={isSubmitting}
                      value={loginForm.password}
                      onChange={(event) =>
                        setLoginForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                    />
                  </div>

                  <button type="submit" className="auth-submit" disabled={isSubmitting}>
                    {isSubmitting ? "Signing In..." : "Sign In"}
                  </button>

                  <div className="auth-form-footer">
                    <span>Need an account?</span>
                    <button
                      type="button"
                      className="auth-footer-link"
                      onClick={() => switchMode("register")}
                    >
                      Create one
                    </button>
                  </div>
                </form>
              ) : (
                <form
                  className="auth-form"
                  id="panel-register"
                  method="post"
                  role="tabpanel"
                  aria-labelledby="tab-register"
                  onSubmit={handleRegisterSubmit}
                >
                  <header className="auth-form-header">
                    <h2>Create account</h2>
                    <p className="auth-form-copy" id="register-help">
                      Create your account and enter a join key if you are joining an existing organization.
                    </p>
                  </header>

                  <div className="auth-field-group">
                    <label htmlFor="register-org">Organization Join Key</label>
                    <input
                      id="register-org"
                      name="joinKey"
                      type="text"
                      placeholder="AB12CD34"
                      autoComplete="off"
                      maxLength={8}
                      disabled={isSubmitting}
                      value={registerForm.joinKey}
                      onChange={(event) =>
                        setRegisterForm((current) => ({
                          ...current,
                          joinKey: event.target.value
                            .toUpperCase()
                            .replace(/[^A-Z0-9]/g, "")
                            .slice(0, 8),
                        }))
                      }
                    />
                    <p className="auth-field-note">
                      Optional. Enter the 8-character join key shared by your organization. Leave it blank to start a new one.
                    </p>
                  </div>

                  <div className="auth-field-grid">
                    <div className="auth-field-group">
                      <label htmlFor="register-email">Email Address</label>
                      <input
                        id="register-email"
                        name="email"
                        type="email"
                        placeholder="alex@indigo.com"
                        autoComplete="email"
                        required
                        disabled={isSubmitting}
                        value={registerForm.email}
                        onChange={(event) =>
                          setRegisterForm((current) => ({
                            ...current,
                            email: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="auth-field-group">
                      <label htmlFor="register-username">Username</label>
                      <input
                        id="register-username"
                        name="username"
                        type="text"
                        placeholder="asterling_admin"
                        autoComplete="username"
                        required
                        disabled={isSubmitting}
                        value={registerForm.username}
                        onChange={(event) =>
                          setRegisterForm((current) => ({
                            ...current,
                            username: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <div className="auth-field-grid">
                    <div className="auth-field-group">
                      <label htmlFor="register-password">Create Password</label>
                      <input
                        id="register-password"
                        name="password"
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        aria-describedby="register-help register-password-note"
                        required
                        disabled={isSubmitting}
                        value={registerForm.password}
                        onChange={(event) =>
                          setRegisterForm((current) => ({
                            ...current,
                            password: event.target.value,
                          }))
                        }
                      />
                    </div>

                    <div className="auth-field-group">
                      <label htmlFor="register-confirm-password">
                        Confirm Password
                      </label>
                      <input
                        id="register-confirm-password"
                        name="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        autoComplete="new-password"
                        aria-invalid={passwordsMismatch}
                        aria-describedby={
                          passwordsMismatch
                            ? "register-password-mismatch"
                            : "register-help"
                        }
                        required
                        disabled={isSubmitting}
                        value={registerForm.confirmPassword}
                        onChange={(event) =>
                          setRegisterForm((current) => ({
                            ...current,
                            confirmPassword: event.target.value,
                          }))
                        }
                      />
                    </div>
                  </div>

                  <p className="auth-field-note" id="register-password-note">
                    Use a strong password that matches your Cognito user pool policy.
                  </p>

                  {passwordsMismatch ? (
                    <p className="auth-error" id="register-password-mismatch" role="alert">
                      Passwords must match before registration can continue.
                    </p>
                  ) : null}

                  <div className="auth-register-note">
                    <strong>Next step</strong>
                    <p>
                      After sign-in, the backend tries the join key first. If it
                      does not match an organization, a new organization is
                      provisioned automatically.
                    </p>
                  </div>

                  <button type="submit" className="auth-submit" disabled={isSubmitting}>
                    {isSubmitting ? "Registering..." : "Create Account"}
                  </button>

                  <div className="auth-form-footer">
                    <span>Already registered?</span>
                    <button
                      type="button"
                      className="auth-footer-link"
                      onClick={() => switchMode("login")}
                    >
                      Sign in
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          <p className="auth-message" role="status" aria-live="polite">
            {message ||
              (cognitoEnabled
                ? "Direct Cognito auth is ready. Tokens are stored locally and sent as bearer requests."
                : "Use the tabs to switch between login and registration.")}
          </p>
        </section>
      </div>
    </main>
  );
}
