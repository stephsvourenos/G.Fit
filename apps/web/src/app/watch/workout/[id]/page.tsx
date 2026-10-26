import { workouts } from "@app/mock-data";
import { WorkoutDetail } from "./WorkoutDetail";

export function generateStaticParams() {
  return workouts.map((w) => ({ id: w.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <WorkoutDetail id={id} />;
}
