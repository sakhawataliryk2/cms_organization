import { redirect } from "next/navigation";

export default function LegacyTimecardsRedirect() {
  redirect("/portal/jobseeker/timesheets");
}
