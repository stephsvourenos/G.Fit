import { PageHeader } from "@/components/AdminShell";
import { ProgrammeBoard } from "./ProgrammeBoard";

export default function ProgrammesAdminPage() {
  return (
    <>
      <PageHeader
        title="Programmes"
        sub="Put workouts in order around a style or goal. Programmes are included in the membership: there's no price to set. Members and the website only ever see the published workouts in a programme."
      />
      <ProgrammeBoard />
    </>
  );
}
