"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";

import { clearSession, createSession, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export async function loginAction(formData: FormData) {
  const parsed = loginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/login?error=invalid");
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  });

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    redirect("/login?error=credentials");
  }

  await createSession({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  redirect("/dashboard");
}

export async function logoutAction() {
  await clearSession();
  redirect("/login");
}

export async function signupAction(formData: FormData) {
  const parsed = signupSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    redirect("/signup?error=invalid");
  }

  const email = parsed.data.email.toLowerCase();
  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    redirect("/signup?error=exists");
  }

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash(parsed.data.password, 12),
      role: "admin",
    },
  });

  await createSession({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  redirect("/dashboard");
}
