import { useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Storefront } from "@/components/storefront";
import { getProducts } from "@/lib/onecart.functions";
import { getTiktokStories } from "@/lib/tiktok.functions";
import { trackPageView } from "@/lib/analytics";

const catalogQuery = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => getProducts(),
});

const tiktokQuery = queryOptions({
  queryKey: ["tiktok-stories"],
  queryFn: () => getTiktokStories(),
  staleTime: 1000 * 60 * 30,
});

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pufkuj – ręcznie robione maskotki szydełkowe" },
      {
        name: "description",
        content:
          "Ręcznie robione maskotki szydełkowe z miękkiej włóczki chenille. Zobacz kolekcję Pufkuj i zamów maskotkę w Polsce.",
      },
    ],
    links: [{ rel: "canonical", href: "https://pufkuj.pl/" }],
  }),
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(catalogQuery),
      context.queryClient.ensureQueryData(tiktokQuery),
    ]),
  component: Home,
});

function Home() {
  const { data } = useSuspenseQuery(catalogQuery);

  useEffect(() => {
    void trackPageView();
  }, []);

  const { data: tiktokStories } = useSuspenseQuery(tiktokQuery);
  return (
    <Storefront
      products={data.products}
      demo={data.demo}
      tiktokStories={tiktokStories}
    />
  );
}
