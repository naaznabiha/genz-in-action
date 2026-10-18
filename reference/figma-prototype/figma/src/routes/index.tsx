import { createFileRoute } from "@tanstack/react-router";
import App from "@/genz/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "GenZ in Action — Community App" },
      {
        name: "description",
        content:
          "Join youth-led communities, share actions, and track real-world impact with GenZ in Action.",
      },
      { property: "og:title", content: "GenZ in Action — Community App" },
      {
        property: "og:description",
        content:
          "Join youth-led communities, share actions, and track real-world impact with GenZ in Action.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return <App />;
}
