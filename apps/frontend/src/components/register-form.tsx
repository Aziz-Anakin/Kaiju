import { cn } from "cn"
import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router"

import { Button } from "@/components/ui/button"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectItem } from "@/components/ui/select"
import { getQuarters, login, register, type Quarter } from "@/services/auth"

export function RegisterForm({
  className,
  ...props
}: React.ComponentProps<"div">) {
  const navigate = useNavigate()
  const [error, setError] = useState("")
  const [quarters, setQuarters] = useState<Quarter[]>([])

  // Charge la liste des 5 quartiers pour le select
  useEffect(() => {
    getQuarters()
      .then(setQuarters)
      .catch((e) => setError((e as Error).message))
  }, [])

  // Vérifie les deux mots de passe, crée le compte puis connecte directement l'officier
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)

    if (form.get("password") !== form.get("confirm-password")) {
      setError("Les deux mots de passe ne sont pas identiques. Retape-les en vérifiant qu'ils sont écrits exactement pareil.")
      return
    }

    try {
      await register(
        String(form.get("name")),
        String(form.get("email")),
        String(form.get("password")),
        Number(form.get("quarterId")),
      )
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
          Inscription
        </span>
        <h1 className="text-5xl font-bold tracking-tight uppercase">
          Rejoindre
        </h1>
      </div>
      <form onSubmit={handleSubmit}>
        <FieldGroup>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Field>
            <FieldLabel
              htmlFor="name"
              className="text-xs tracking-widest uppercase"
            >
              Nom
            </FieldLabel>
            <Input id="name" name="name" className="h-11 rounded-none" required />
          </Field>
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
              htmlFor="quarterId"
              className="text-xs tracking-widest uppercase"
            >
              Quartier
            </FieldLabel>
            <Select
              id="quarterId"
              name="quarterId"
              placeholder="Choisir un quartier"
              className="h-11 rounded-none"
              required
            >
              {quarters.map((quarter) => (
                <SelectItem key={quarter.id} value={String(quarter.id)}>
                  {quarter.name} ({quarter.code})
                </SelectItem>
              ))}
            </Select>
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
            <FieldLabel
              htmlFor="confirm-password"
              className="text-xs tracking-widest uppercase"
            >
              Confirmer le mot de passe
            </FieldLabel>
            <Input
              id="confirm-password"
              name="confirm-password"
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
              Créer mon compte
            </Button>
            <Link
              to="/login"
              className="text-center text-xs font-semibold tracking-widest text-primary uppercase"
            >
              Déjà un compte ? Se connecter
            </Link>
          </Field>
        </FieldGroup>
      </form>
    </div>
  )
}
