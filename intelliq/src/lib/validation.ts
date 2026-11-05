import { z } from "zod";

const NAME_MSG = "Please enter your name (2–60 characters).";
const EMAIL_MSG = "Please enter a valid email address.";
export const nameField = z.string().trim().min(2, NAME_MSG).max(60, NAME_MSG);

export const registerSchema = z.object({
  name: nameField,
  email: z.string().trim().toLowerCase().email(EMAIL_MSG).max(254, EMAIL_MSG),
  lang: z.enum(["en", "mn"]).optional(), // the language the visitor was using; sets the account language and the email language
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .max(128)
    .regex(/[a-z]/, "Add a lowercase letter")
    .regex(/[A-Z]/, "Add an uppercase letter")
    .regex(/[0-9]/, "Add a number"),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(EMAIL_MSG),
  password: z.string().min(1).max(128),
});

export const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email(EMAIL_MSG), lang: z.enum(["en", "mn"]).optional() });

export const resetSchema = z.object({
  token: z.string().min(20).max(200),
  password: registerSchema.shape.password,
});
