import { redirect } from "next/navigation";

/** Legacy home — new portal lands on Timesheets. */
export default function JobSeekerHomeRedirect() {
  redirect("/portal/jobseeker/timesheets");
}
