import { Outlet } from "react-router-dom";
import { Wallet } from "lucide-react";

export function AuthLayout() {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background text-foreground transition-colors duration-300">
      {/* Left side: Branding & Hero */}
      <div className="hidden lg:flex flex-col justify-between bg-emerald-900 text-white p-12">
        <div className="flex items-center gap-2 font-bold text-2xl">
          <Wallet className="h-8 w-8 text-emerald-400" />
          <span>MoneyMate</span>
        </div>
        
        <div className="space-y-6 max-w-lg">
          <h1 className="text-4xl font-bold leading-tight">
            Take control of your finances today.
          </h1>
          <p className="text-emerald-200 text-lg">
            Track income, manage expenses, set savings goals, and understand your financial habits with beautiful, actionable insights.
          </p>
        </div>
        
        <div className="text-sm text-emerald-400/80">
          © {new Date().getFullYear()} MoneyMate Inc. All rights reserved.
        </div>
      </div>

      {/* Right side: Auth Forms */}
      <div className="flex flex-col justify-center items-center p-8 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Header */}
          <div className="flex lg:hidden items-center justify-center gap-2 font-bold text-2xl mb-8">
            <Wallet className="h-8 w-8 text-primary" />
            <span className="text-primary">MoneyMate</span>
          </div>

          {/* Form Outlet */}
          <Outlet />
        </div>
      </div>
    </div>
  );
}
