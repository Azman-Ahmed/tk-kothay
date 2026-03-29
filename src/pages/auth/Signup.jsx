import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, Lock, UserPlus, User } from "lucide-react";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { getSupabaseBrowserClient } from "../../lib/supabase/browser-client";

export function Signup() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();
  const supabase = getSupabaseBrowserClient();

  const handleSignup = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setStatus("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: name },
        emailRedirectTo: `${window.location.origin}/`,
      }
    });

    if (error) {
      setStatus(error.message);
      setIsLoading(false);
    } else {
      setStatus("Check your inbox to confirm the new account.");
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    setIsLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      }
    });
    
    if (error) {
      setStatus(error.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight">Create an account</h1>
        <p className="text-sm text-muted-foreground">
          Enter your details below to create your account
        </p>
      </div>
      
      <form onSubmit={handleSignup} className="space-y-4 pt-4">
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none" htmlFor="name">
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="name"
              placeholder="John Doe"
              type="text"
              required
              className="pl-10"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium leading-none" htmlFor="email">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="email"
              placeholder="name@example.com"
              type="email"
              required
              className="pl-10"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium leading-none" htmlFor="password">
            Password
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              id="password"
              type="password"
              required
              minLength={6}
              className="pl-10"
              placeholder="At least 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
        </div>
        
        {status && (
          <p className={status.includes("Check your inbox") ? "text-sm text-emerald-500" : "text-sm text-rose-500"} role="status" aria-live="polite">
            {status}
          </p>
        )}

        <Button disabled={isLoading} type="submit" className="w-full h-11 text-base shadow-sm">
          <UserPlus className="mr-2 h-4 w-4" /> {isLoading ? "Processing..." : "Sign Up"}
        </Button>
      </form>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">
            Or continue with
          </span>
        </div>
      </div>

      <Button
        variant="outline"
        type="button"
        disabled={isLoading}
        className="w-full h-11"
        onClick={handleGoogleSignup}
      >
        <svg
          className="mr-2 h-4 w-4"
          aria-hidden="true"
          focusable="false"
          data-prefix="fab"
          data-icon="google"
          role="img"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 488 512"
        >
          <path
            fill="currentColor"
            d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"
          />
        </svg>
        Google
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link
          to="/login"
          className="font-semibold text-emerald-600 hover:text-emerald-500 hover:underline transition-colors"
        >
          Sign in
        </Link>
      </p>

      <p className="px-8 text-center text-xs text-muted-foreground mt-8">
        By clicking continue, you agree to our{" "}
        <a href="#" className="underline underline-offset-4 hover:text-emerald-600">
          Terms of Service
        </a>{" "}
        and{" "}
        <a href="#" className="underline underline-offset-4 hover:text-emerald-600">
          Privacy Policy
        </a>
        .
      </p>
    </div>
  );
}
