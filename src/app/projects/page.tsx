"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";

export default function ProjectsPage() {
  return (
    <div>
      <div className="mb-6">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Link>
      </div>
      <h1 className="text-3xl font-bold tracking-tight">All Projects</h1>
      <p className="mt-1 text-muted-foreground">
        View all projects on the dashboard.
      </p>
    </div>
  );
}
