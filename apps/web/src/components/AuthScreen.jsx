import React, { useState } from "react";
import { Activity, ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { isSupabaseConfigured, supabase } from "../lib/supabase";

export function AuthScreen({ onPreview }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        if (error) throw error;
        setMessage("Password reset link sent. Check your inbox.");
      } else if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: email.split("@")[0] } }
        });
        if (error) throw error;
        setMessage(data.session ? "Workspace created." : "Check your inbox to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (error) {
      setMessage(error.message);
    } finally {
      setBusy(false);
    }
  }

  const title = mode === "signup" ? "Create your workspace" : mode === "reset" ? "Reset your password" : "Welcome back";
  const submitLabel = mode === "signup" ? "Create account" : mode === "reset" ? "Send reset link" : "Sign in";

  return (
    <main className="auth-page">
      <section className="auth-story">
        <div className="auth-brand"><span><Activity size={20} /></span>AgentScope Sidekick</div>
        <div className="auth-copy">
          <h1>See exactly why an agent run went wrong.</h1>
          <p>Trace-first incident investigation for tool failures, retrieval misses, token spikes, and latency regressions.</p>
          <ul>
            <li><CheckCircle2 size={17} />Correlate traces, metrics, and logs</li>
            <li><CheckCircle2 size={17} />Explain root cause from telemetry evidence</li>
            <li><CheckCircle2 size={17} />Turn investigations into alert guardrails</li>
          </ul>
        </div>
        <small>Built for SigNoz Track 1 with OpenTelemetry-native evidence.</small>
      </section>
      <section className="auth-form-wrap">
        <form className="auth-form" onSubmit={submit}>
          <div>
            <h2>{title}</h2>
            <p>{mode === "signup" ? "Start with a seeded incident workspace." : "Continue to your incident workspace."}</p>
          </div>
          {!isSupabaseConfigured && (
            <div className="config-notice">
              Supabase is not configured in this environment. Preview mode keeps data in this browser.
            </div>
          )}
          <label>
            Work email
            <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@company.com" required />
          </label>
          {mode !== "reset" && (
            <label>
              Password
              <span className="password-field">
                <input type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required />
                <button type="button" onClick={() => setShowPassword((value) => !value)} aria-label={showPassword ? "Hide password" : "Show password"}>
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </span>
            </label>
          )}
          {mode === "signin" && <button type="button" className="text-button align-right" onClick={() => setMode("reset")}>Forgot password?</button>}
          {message && <div className="auth-message" role="status">{message}</div>}
          <button className="primary auth-submit" disabled={busy || !isSupabaseConfigured}>
            {busy ? <LoaderCircle className="spin" size={17} /> : <ArrowRight size={17} />}{submitLabel}
          </button>
          {!isSupabaseConfigured && <button type="button" className="secondary auth-submit" onClick={onPreview}>Open product preview</button>}
          <div className="auth-switch">
            {mode === "signup" ? "Already have an account?" : "New to AgentScope?"}
            <button type="button" className="text-button" onClick={() => setMode(mode === "signup" ? "signin" : "signup")}>
              {mode === "signup" ? "Sign in" : "Create account"}
            </button>
          </div>
          {mode === "reset" && <button type="button" className="text-button" onClick={() => setMode("signin")}>Back to sign in</button>}
        </form>
      </section>
    </main>
  );
}
