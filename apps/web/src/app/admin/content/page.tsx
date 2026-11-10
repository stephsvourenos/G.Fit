import { PageHeader } from "@/components/AdminShell";
import { ContentBoard } from "./ContentBoard";

export default function ContentPage() {
  return (
    <>
      <PageHeader
        title="Content approval & scheduling"
        sub="Create workouts, upload their videos (captions are made automatically) and move them through review. Publishing is blocked until the video and captions are ready and the licence, music rights, safety review and (for child coaches) guardian consent are complete."
      />
      <ContentBoard />
    </>
  );
}
