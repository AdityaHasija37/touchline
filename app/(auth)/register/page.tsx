import type { Metadata } from "next";
import { AuthCard } from "../auth-card";
import { DemoShortcut } from "../demo-shortcut";
import { RegisterForm } from "../auth-forms";

export const metadata: Metadata = { title: "Create account · Touchline" };

export default function RegisterPage() {
  return (
    <>
      <AuthCard
        title="Create your account"
        subtitle="Set up your team in a few minutes."
      >
        <RegisterForm />
      </AuthCard>
      <DemoShortcut />
    </>
  );
}
