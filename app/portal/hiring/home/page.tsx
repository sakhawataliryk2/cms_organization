import { redirect } from "next/navigation";

/** Legacy home — primary landing is Time Cards. */
export default function HiringHomeRedirect() {
  redirect("/portal/hiring/timecards");
}
