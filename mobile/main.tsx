import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRouteWithContext, createRouter, Outlet, RouterProvider, HeadContent } from '@tanstack/react-router';
import { Toaster } from 'sonner';
import { Button } from '../src/components/ui/button';
import { Route as home } from '../src/routes/index';
import { Route as privacy } from '../src/routes/privacy';
import { Route as terms } from '../src/routes/terms';
import '../src/styles.css';

const queryClient = new QueryClient();
const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: () => <QueryClientProvider client={queryClient}><HeadContent /><Outlet /><Toaster richColors /></QueryClientProvider>,
  errorComponent: ({ reset }) => <main className="legal-page p-6"><h1 className="text-xl font-semibold">This page couldn’t load</h1><p className="my-4">Please try again. Your chat is never saved.</p><Button onClick={reset}>Try again</Button></main>,
  notFoundComponent: () => <main className="legal-page p-6"><h1>Page not found</h1><Button asChild><a href="/">Go home</a></Button></main>,
});
// Explicit UI-only tree: never import the generated web tree, which includes server handlers.
const routeTree = rootRoute.addChildren([
  home.update({ id: '/', path: '/', getParentRoute: () => rootRoute }),
  privacy.update({ id: '/privacy', path: '/privacy', getParentRoute: () => rootRoute }),
  terms.update({ id: '/terms', path: '/terms', getParentRoute: () => rootRoute }),
]);
const router = createRouter({ routeTree, context: { queryClient }, scrollRestoration: true });
const container = document.getElementById('root');
if (container) createRoot(container).render(<RouterProvider router={router} />);