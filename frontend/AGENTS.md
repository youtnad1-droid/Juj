<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Storefront data access lives in `src/lib/catalog.server.ts`, shared by server functions (UI) and REST routes under `src/routes/api/v1` — one source of truth for queries.
- The category tree is passed via the root route loader data (not the query cache) — avoids SSR hydration mismatches without SSR query dehydration.
- Offer grids load client-side with cursor-based infinite queries — "Show more" pagination, no page numbers.
