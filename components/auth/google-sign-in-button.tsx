import { signInWithGoogle } from "@/actions/auth";

import { SubmitButton } from "./form-parts";

export function GoogleSignInButton({ next }: { next: string }) {
  return (
    <form action={signInWithGoogle}>
      <input type="hidden" name="next" value={next} />
      <SubmitButton variant="outline" pendingLabel="Redirecting to Google…">
        Continue with Google
      </SubmitButton>
    </form>
  );
}
