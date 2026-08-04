"use client";

import { useActionState } from "react";
import { loginFormAction } from "@/lib/auth/actions";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginFormAction, null);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4 rounded-[14px] border border-border bg-surface p-8">
      <div className="mb-1 flex items-center gap-2.5">
        <div className="flex h-[30px] w-[30px] flex-none items-center justify-center rounded-lg bg-ink text-[17px] font-bold text-white [letter-spacing:-0.5px]">
          b
        </div>
        <div className="flex flex-col leading-[1.05]">
          <span className="text-[15px] font-bold [letter-spacing:-0.3px]">bigbuda</span>
          <span className="text-[10.5px] font-medium text-muted-2">Planificador</span>
        </div>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold text-muted-2">Email</span>
        <input
          type="email"
          name="email"
          required
          autoFocus
          placeholder="tú@bigbuda.com"
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-[11.5px] font-semibold text-muted-2">Contraseña</span>
        <input
          type="password"
          name="password"
          required
          className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-ink"
        />
      </label>

      {state?.error && <p className="text-[12.5px] font-semibold text-danger">{state.error}</p>}

      <button
        type="submit"
        disabled={pending}
        className="btn-primary mt-1 rounded-lg border-none bg-accent px-4 py-2.5 font-sans text-[13px] font-semibold text-white disabled:opacity-60"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
