import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SignInForm } from "@/components/auth/sign-in-form";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { safeRedirectPath } from "@/lib/auth/routes";
import { getCurrentUser } from "@/lib/security/auth";

export const metadata: Metadata = { title: "Sign in" };

const ERROR_MESSAGES: Record<string, string> = {
  callback:
    "We couldn't complete sign-in. The link may have expired or been opened in a different browser. If you just verified your email, please sign in.",
  oauth: "Google sign-in is unavailable right now. Please try again.",
  oauth_cancelled: "Google sign-in was cancelled.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeRedirectPath(params.next, "/");
  const mode = params.mode === "register" ? "register" : "signin";
  const errorKey = typeof params.error === "string" ? params.error : "";
  const errorMessage = ERROR_MESSAGES[errorKey];

  if (await getCurrentUser()) redirect(next);

  const nextQuery = `next=${encodeURIComponent(next)}`;

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-heading-1 text-primary">
          {mode === "register" ? "Create an account" : "Sign in"}
        </h1>
        {next.startsWith("/checkout") ? (
          <p className="text-body-sm text-muted-foreground">
            Sign in to continue to checkout. You&apos;ll come straight back.
          </p>
        ) : null}
      </div>

      {errorMessage ? (
        <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-body-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}

      {mode === "register" ? <SignUpForm next={next} /> : <SignInForm next={next} />}

      <div className="flex items-center gap-3 text-caption text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleSignInButton next={next} />

      <div className="flex flex-col gap-2 text-body-sm">
        {mode === "register" ? (
          <p>
            Already have an account?{" "}
            <Link href={`/login?${nextQuery}`} className="font-medium text-accent underline underline-offset-4">
              Sign in
            </Link>
          </p>
        ) : (
          <>
            <p>
              New to Samy&apos;s Bakery?{" "}
              <Link
                href={`/login?mode=register&${nextQuery}`}
                className="font-medium text-accent underline underline-offset-4"
              >
                Create an account
              </Link>
            </p>
            <p>
              <Link href="/reset-password" className="font-medium text-accent underline underline-offset-4">
                Forgot your password?
              </Link>
            </p>
          </>
        )}
      </div>
    </>
  );
}
