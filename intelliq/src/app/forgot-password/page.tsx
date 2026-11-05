import type { Metadata } from "next";
import { ForgotForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Forgot password" };

export default function Page() {
  return <ForgotForm />;
}
