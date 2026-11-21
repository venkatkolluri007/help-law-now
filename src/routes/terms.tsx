import { createFileRoute } from '@tanstack/react-router';
import { LegalPage } from '@/components/legal-page';

export const Route = createFileRoute('/terms')({
  head: () => ({ meta: [
    { title: 'Terms — Ally AI' },
    { name: 'description', content: 'Terms for using Ally AI’s legal triage chat and attorney directory.' },
    { property: 'og:title', content: 'Terms — Ally AI' },
    { property: 'og:description', content: 'Terms for using Ally AI’s legal triage chat and attorney directory.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: TermsPage,
});

function TermsPage() {
  return <LegalPage title="Terms">
    <section><h2 className="font-semibold">Not legal advice</h2><p>Ally AI offers general triage and helps you find independent legal professionals. It is not a law firm, does not give legal advice, and does not create an attorney-client relationship. AI responses and summaries can contain mistakes. Consult a qualified attorney about your situation and deadlines.</p></section>
    <section><h2 className="font-semibold">Chat and availability</h2><p>No account is required and we do not store chat history. Messages are processed by OpenAI and our hosted services as described in our Privacy page. Internet access is required for chat, searches, and listing submissions. Availability and uninterrupted service are not guaranteed. Do not rely on this app for emergencies.</p></section>
    <section><h2 className="font-semibold">Attorney suggestions and listings</h2><p>Suggestions are a starting point for your own research, not an endorsement or professional referral. Verify credentials, bar standing, fees, and suitability before hiring. Self-submitted listings and photos are stored for review; a pending listing is not verified. Submit accurate information you have the right to publish. The site operator may reject or remove listings.</p></section>
    <section><h2 className="font-semibold">Your responsibility</h2><p>Do not abuse the service, impersonate others, or upload unlawful content. Review any downloaded summary before sharing it. You are responsible for choosing an attorney and protecting any documents saved on your device.</p></section>
  </LegalPage>;
}