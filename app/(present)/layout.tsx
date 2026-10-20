import { requireUser } from "@/lib/auth/session";

/** Full-screen presenter: authenticated, no app chrome (UX-002 S09). */
export default async function PresentLayout({ children }: { children: React.ReactNode }) {
  await requireUser();
  return <div className="bg-zinc-950">{children}</div>;
}
