"use server";

import { signIn } from "@/lib/auth";
import { AuthError } from "next-auth";

export async function loginAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  try {
    await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirectTo: "/dashboard/market",
    });
  } catch (err) {
    // NEXT_REDIRECT is thrown by signIn on success — let it propagate
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;

    if (err instanceof AuthError) {
      switch (err.type) {
        case "CredentialsSignin":
          return "Email atau password salah. Silakan coba lagi.";
        default:
          return "Terjadi kesalahan autentikasi. Silakan coba lagi.";
      }
    }

    throw err;
  }

  return null;
}
