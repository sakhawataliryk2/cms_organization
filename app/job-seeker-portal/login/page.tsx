import { redirect } from "next/navigation";

export default function LegacyJobSeekerLoginRedirect() {
  redirect("/portal/login");
}
