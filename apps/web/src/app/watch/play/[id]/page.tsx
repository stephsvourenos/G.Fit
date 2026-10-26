import { workouts } from "@app/mock-data";
import { Player } from "./Player";

export function generateStaticParams() {
  return workouts.map((w) => ({ id: w.id }));
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <Player id={id} />;
}
