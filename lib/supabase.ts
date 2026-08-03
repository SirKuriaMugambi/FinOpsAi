import { createBrowserClient, createServerClient } from "@supabase/ssr"
import type { SupabaseClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

let browserClientSingleton: SupabaseClient | null = null

export function createSupabaseBrowserClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  if (!browserClientSingleton) {
    browserClientSingleton = createBrowserClient(supabaseUrl, supabaseAnonKey)
  }

  return browserClientSingleton
}

// Resolves the current authenticated user and their profiles.role in one
// call, for Route Handlers that need to gate an action by role (e.g. only
// finance_manager may approve a payroll run). Returns null if there's no
// authenticated session or Supabase isn't configured.
export async function getAuthedUserWithRole(): Promise<{ id: string; role: string } | null> {
  const supabase = await createSupabaseServerClient()
  if (!supabase) return null

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single()
  if (!profile) return null

  return { id: user.id, role: profile.role as string }
}

// Server Component / Route Handler client — reads the user's session from cookies.
// Next.js 16: `cookies()` is async, and Server Components cannot write cookies
// (middleware owns session refresh), so `setAll` is a best-effort no-op there.
export async function createSupabaseServerClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          )
        } catch {
          // Called from a Server Component — middleware handles session refresh instead.
        }
      },
    },
  })
}
