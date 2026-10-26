import { instructors } from "@app/mock-data";
import { InstructorView } from "./InstructorView";

export function generateStaticParams() {
  return instructors.map((i) => ({ id: i.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InstructorView id={id} />;
}
