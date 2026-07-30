"use client"

import React, { useState } from "react"
import { useRouter } from "next/navigation"
import { useFinOps } from "@/components/finops-provider"
import { useTheme } from "@/components/theme-provider"
import Logo from "@/components/logo"
import Link from "next/link"
import { ShieldCheck, ArrowRight } from "lucide-react"

export default function SignInPage() {
  const router = useRouter()
  const { setCurrentUser, addAuditLog } = useFinOps()
  const { cardRadius, buttonRadius, accentBg, accentText } = useTheme()

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [operator, setOperator] = useState("Mercy")

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return

    // Set active session user context
    setCurrentUser(operator)

    // Append immutable audit log
    addAuditLog(
      "USER SIGN-IN",
      "OAuth / Mock Audit Verify",
      `System operator "${operator}" authenticated successfully. Session initiated.`
    )

    // Redirect to main suite
    router.push("/dashboard")
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-zinc-50 dark:bg-black p-4 font-sans text-xs antialiased">
      <div className={`w-full max-w-sm bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-900 p-6 sm:p-8 space-y-6 shadow-xl ${cardRadius}`}>

        {/* Logo and header */}
        <div className="text-center space-y-2">
          <Logo className="justify-center" />
          <p className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest pt-2">OPERATIONAL PORTAL SIGN-IN</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-zinc-400 uppercase block">Active Operator Context</label>
            <select
              value={operator}
              onChange={(e) => setOperator(e.target.value)}
              className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
            >
              <option value="Mercy">Mercy Njoroge (Senior Accountant)</option>
              <option value="Tony">Tony Mwangi (Finance Manager)</option>
              <option value="Harrison">Harrison Kiarie (Production Manager)</option>
              <option value="Charles">Charles Otieno (Business Controller)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-zinc-400 uppercase block">Corporate Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="operator@chrysal-africa.co.ke"
              className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-mono text-zinc-400 uppercase block">Secure Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className={`w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-zinc-400 ${buttonRadius}`}
              required
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className={`w-full py-2 font-mono text-[10px] uppercase font-bold tracking-wider flex items-center justify-center gap-1.5 ${accentBg} ${buttonRadius}`}
            >
              <span>Initialize Session</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </form>

        {/* Footer */}
        <div className="border-t dark:border-zinc-900 pt-4 flex flex-col sm:flex-row items-center justify-between text-[10px] text-zinc-400 font-mono">
          <span>Need an account? <Link href="/sign-up" className={`${accentText} hover:underline font-semibold`}>Sign Up</Link></span>
          <div className="flex items-center gap-1 mt-1.5 sm:mt-0 text-[9px] text-emerald-600">
            <ShieldCheck className="h-3.5 w-3.5" />
            <span>AES-256 SSL SECURED</span>
          </div>
        </div>
      </div>
    </div>
  )
}
