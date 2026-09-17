import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/portal-links")({
  head: () => ({ meta: [{ title: "Student Portal — KNUST-ATTENDANCE-APP" }] }),
  component: PortalLinksRedirect,
});

export function PortalLinksRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    navigate({ to: "/dashboard" });
  }, [navigate]);

  return null;
}
