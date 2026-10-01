import { cn } from "cn"
import { useState } from "react"
import { Link, useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { login } from "@/services/auth"

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate()
  const [error, setError] = useState("")

  // Envoie l'email et le mot de passe au backend puis ouvre le tableau de bord
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    try {
      await login(String(form.get("email")), String(form.get("password")))
      navigate("/")
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className={cn("flex flex-col gap-8", className)} {...props}>
      <div className="flex flex-col gap-1">
        <img src="/logo.webp" alt="Logo KAIJU" className="mb-4 size-20 rounded-full" />
        <span className="text-xs tracking-widest text-primary uppercase">
          Connexion
        </span>
        <h1 className="text-5xl font-bold tracking-tight uppercase">
          Bienvenue
        </h1>
      </div>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Field>
            <FieldLabel
              htmlFor="email"
              className="text-xs tracking-widest uppercase"
            >
              Email
            </FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              className="h-11 rounded-none"
              required
            />
          </Field>
          <Field>
            <FieldLabel
              htmlFor="password"
              className="text-xs tracking-widest uppercase"
            >
              Mot de passe
            </FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              className="h-11 rounded-none"
              required
            />
          </Field>
          <Field>
            <Button
              type="submit"
              className="h-11 rounded-none text-xs font-semibold tracking-widest uppercase"
            >
              Se connecter
            </Button>
            <Link
              to="/register"
              className="text-center text-xs font-semibold tracking-widest text-primary uppercase"
            >
              Pas de compte ? S'inscrire
            </Link>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
