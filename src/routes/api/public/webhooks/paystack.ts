import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/webhooks/paystack")({
  server: {
    handlers: {
      POST: async () => {
        return new Response(
          JSON.stringify({
            status: "disabled",
            message: "Payments are disabled. Qmark is 100% free.",
          }),
          {
            status: 200,
            headers: { "Content-Type": "application/json" },
          },
        );
      },
    },
  },
});
