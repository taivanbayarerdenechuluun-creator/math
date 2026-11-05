import { Suspense } from "react";
import type { Metadata } from "next";
import { ResetForm } from "@/components/auth/AuthForm";

export const metadata: Metadata = { title: "Reset password" };

export default function Page() {
  return (
    <Suspense>
      <ResetForm />
    </Suspense>
  );
}
