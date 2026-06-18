import { createFileRoute } from "@tanstack/react-router";
import { Calculator } from "@/components/calcify/Calculator";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Calcify — Where Precision Meets Elegance" },
      {
        name: "description",
        content:
          "Calcify is a premium, elegant calculator with glassmorphism design, dark mode, keyboard support, and calculation history.",
      },
      { property: "og:title", content: "Calcify — Where Precision Meets Elegance" },
      {
        property: "og:description",
        content:
          "A premium calculator web app with glassmorphism design, dark mode, and calculation history.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return <Calculator />;
}
