import { zodResolver } from '@hookform/resolvers/zod'
import { Loader2, Store } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Field } from '@/components/common'
import { apiErrorMessage } from '@/lib/api'
import { useAuth } from '@/lib/auth'
import { loginSchema, type LoginForm } from '@/lib/schemas'
import { usePageTitle } from '@/lib/usePageTitle'

export default function LoginPage() {
  usePageTitle('Sign in')
  const { admin, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [error, setError] = useState<string | null>(null)
  const form = useForm<LoginForm>({ resolver: zodResolver(loginSchema), defaultValues: { email: '', password: '' } })
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (admin) return <Navigate to={from} replace />

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setError(null)
    try {
      await login(email, password)
      navigate(from, { replace: true })
    } catch (e) {
      setError(apiErrorMessage(e, 'Login failed'))
    }
  })

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/40 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Store className="size-5" />
          </div>
          <CardTitle>Kirana Admin</CardTitle>
          <CardDescription>Sign in to manage orders, products and store settings.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4" noValidate>
            <Field label="Email" htmlFor="email" error={form.formState.errors.email?.message}>
              <Input id="email" type="email" autoComplete="username" {...form.register('email')} />
            </Field>
            <Field label="Password" htmlFor="password" error={form.formState.errors.password?.message}>
              <Input id="password" type="password" autoComplete="current-password" {...form.register('password')} />
            </Field>
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" />}
              Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  )
}
