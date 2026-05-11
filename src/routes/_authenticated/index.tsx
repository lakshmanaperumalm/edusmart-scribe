import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/_authenticated/")({
  component: () => {
    const navigate = useNavigate();
    useEffect(() => { navigate({ to: "/dashboard" }); }, [navigate]);
    return null;
  },
});
