"use client";
import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Field } from "@/components/ui";
import { signIn, signUp, type AuthState } from "./actions";

function Submit({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button className="btn btn-primary btn-lg btn-block" disabled={pending}>{pending ? "Un momento…" : children}</button>;
}

export function AuthForm({ mode, next }: { mode: "in" | "up"; next?: string }) {
  const [state, action] = useActionState<AuthState, FormData>(mode === "in" ? signIn : signUp, {});
  return (
    <form action={action} className="auth-form" noValidate>
      {state.error && <div className="alert bad" role="alert">{state.error}</div>}
      {state.info && <div className="alert ok" role="status">{state.info}</div>}
      {mode === "up" && (
        <Field label="Tu nombre" htmlFor="name"><input className="input" id="name" name="name" autoComplete="name" required /></Field>
      )}
      <Field label="Correo" htmlFor="email">
        <input className="input" id="email" name="email" type="email" autoComplete="email" defaultValue={state.email} required />
      </Field>
      <Field label="Contraseña" htmlFor="password" hint={mode === "up" ? "Mínimo 8 caracteres." : undefined}>
        <input className="input" id="password" name="password" type="password" autoComplete={mode === "in" ? "current-password" : "new-password"} minLength={8} required />
      </Field>
      <input type="hidden" name="next" value={next ?? ""} />
      <Submit>{mode === "in" ? "Ingresar" : "Crear cuenta"}</Submit>
      <p className="muted" style={{ fontSize: 14, textAlign: "center" }}>
        {mode === "in" ? <>¿No tienes cuenta? <Link href="/registro">Crea tu tienda gratis</Link></>
          : <>¿Ya tienes cuenta? <Link href="/ingresar">Ingresa</Link></>}
      </p>
    </form>
  );
}
