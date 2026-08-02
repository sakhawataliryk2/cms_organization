import { redirect } from "next/navigation";

export default function LegacyJobSeekerForgotPasswordRedirect() {
  redirect("/portal/forgot-password?role=JOB_SEEKER");
}
