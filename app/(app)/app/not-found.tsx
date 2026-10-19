import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

/** Generic on purpose: never reveal whether another team's record exists (UX-002 §7). */
export default function AppNotFound() {
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="mt-2 text-muted-foreground">It may have been deleted, or you might not have access to it.</p>
      <Link href="/app/teams" className={buttonVariants({ className: "mt-6" })}>
        Back to your teams
      </Link>
    </div>
  );
}
