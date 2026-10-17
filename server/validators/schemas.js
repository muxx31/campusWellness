import { z } from "zod";

const password = z.string().min(8, "Password must be at least 8 characters").max(72);

export const studentRegisterSchema = z.object({
  studentId: z
    .string()
    .trim()
    .min(3, "Student ID is too short")
    .max(40)
    .regex(/^[A-Za-z0-9._-]+$/, "Student ID may only contain letters, numbers, . _ -"),
  name: z.string().trim().min(1, "Name is required").max(100),
  password,
});

export const studentLoginSchema = z.object({
  studentId: z.string().trim().min(1, "Student ID is required").max(40),
  password: z.string().min(1, "Password is required").max(72),
});

export const counselorSignupSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  email: z.string().trim().toLowerCase().email("Invalid email").max(254),
  password,
});

export const emailLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Invalid email").max(254),
  password: z.string().min(1, "Password is required").max(72),
});

export const bookingSchema = z.object({
  counselorId: z.string().regex(/^[a-f\d]{24}$/i, "Invalid counselor"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm"),
  issue: z.string().trim().max(1000).optional(),
});

export const idParamSchema = z.object({
  id: z.string().regex(/^[a-f\d]{24}$/i, "Invalid id"),
});

export const counselorStatusSchema = z.object({
  status: z.enum(["approved", "rejected", "pending"]),
});
