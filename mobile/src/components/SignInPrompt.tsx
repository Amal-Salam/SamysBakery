import { router } from "expo-router";
import type { ReactNode } from "react";

import { Button, StateView } from "./ui";

export function SignInPrompt({ illustration, title }: { illustration: ReactNode; title: string }) {
  return (
    <StateView
      illustration={illustration}
      title={title}
      action={<Button label="Sign in" onPress={() => router.push("/sign-in")} />}
    />
  );
}
