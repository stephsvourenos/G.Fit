import { PageHeader } from "@/components/AdminShell";
import { ContentBoard } from "./ContentBoard";

export default function ContentPage() {
  return (
    <>
      <PageHeader
        title="Content approval & scheduling"
        sub="Only admins can move a workout through the workflow. Publishing is blocked until the licence, music rights, safety review and (for minor instructors) guardian consent are complete."
      />
      <ContentBoard />
    </>
  );
}
