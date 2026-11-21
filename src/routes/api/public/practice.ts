import { createFileRoute } from '@tanstack/react-router';
import { submitPractice } from '@/lib/submit-practice.functions';
import { corsHeaders, withCors } from '@/lib/cors';

// Intentional public self-serve submission; the existing validator bounds every
// field and photo. No private data is returned and no approval status is accepted.
export const Route = createFileRoute('/api/public/practice')({
  server: {
    handlers: {
      OPTIONS: ({ request }) => new Response(null, { status: 204, headers: corsHeaders(request) }),
      POST: async ({ request }) => {
        try {
          const length = Number(request.headers.get('Content-Length') || 0);
          if (length > 6 * 1024 * 1024) return withCors(request, new Response('Profile photo must be an image under 5MB', { status: 413 }));
          const result = await submitPractice({ data: await request.formData() });
          return withCors(request, Response.json(result));
        } catch (error) {
          console.error('[practice] submission failed', error);
          return withCors(request, new Response(error instanceof Error ? error.message : 'Submission failed. Please try again.', { status: 400 }));
        }
      },
    },
  },
});