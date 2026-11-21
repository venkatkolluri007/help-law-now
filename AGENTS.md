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

- Keep the native SPA in `mobile/` with an explicit UI-only route tree and `vite.mobile.config.ts`; this excludes SSR and server handlers from Capacitor assets without changing web deployment.
- Client mutations use `src/lib/api.ts`; native calls use the configured hosted origin and web calls remain relative to preserve streaming and submission behavior.
- Reuse existing practice validation/upload via the intentional public submission endpoint; never accept client-selected review status or return private submission data.
