import { createFileRoute } from '@tanstack/react-router';
import { LegalPage } from '@/components/legal-page';

export const Route = createFileRoute('/privacy')({
  head: () => ({ meta: [
    { title: 'Privacy — Ally AI' },
    { name: 'description', content: 'How Ally AI handles private chats, attorney listings, and site analytics.' },
    { property: 'og:title', content: 'Privacy — Ally AI' },
    { property: 'og:description', content: 'How Ally AI handles private chats, attorney listings, and site analytics.' },
    { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' },
  ] }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return <LegalPage title="Privacy">
    <section><h2 className="font-semibold">Private conversations</h2><p>No account is required. We do not save chat history in our database or browser storage. Conversations stay in memory during your current session. Closing or reloading the app clears them. A summary you download is saved on your device at your choice.</p></section>
    <section><h2 className="font-semibold">Message processing</h2><p>Your messages are sent to our hosted service and OpenAI to provide triage and search for attorneys. OpenAI may process and retain data under its own policies; our no-chat-history promise does not mean third-party processing has no retention. Operational logs may include technical errors and message-derived summary or search details. Avoid sharing unnecessary sensitive information. See <a className="underline" href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noreferrer">OpenAI’s privacy policy</a>.</p></section>
    <section><h2 className="font-semibold">Attorney listings</h2><p>Names, titles, specialties, locations, descriptions, and uploaded photos are stored with Lovable Cloud for review. Pending and approved listings, including photos, may appear publicly in the directory. Do not submit confidential client information. Listings remain stored until removed by the site operator.</p></section>
    <section><h2 className="font-semibold">Website analytics</h2><p>On our published website, page visits, clicks, time on page, page speed, and errors are recorded for every visitor. This analytics uses no cookies, stores nothing on your device, does not keep IP addresses, and does not identify visitors. It records pages visited, referral sources, country, browser, operating system, device type, how long visits last, loading performance, and errors. Detailed data is kept for 90 days and daily summaries for a year.</p><p>Lovable collects this data for us. <a className="underline" href="https://lovable.dev/privacy" target="_blank" rel="noreferrer">Lovable’s privacy policy</a> explains how it handles it. Error reports may include technical error details. The native app’s hosted requests can also appear in service logs.</p></section>
    <section><h2 className="font-semibold">Independent services</h2><p>Attorney links open independent websites with their own privacy practices. Ally AI is not a law firm and does not provide legal advice.</p></section>
  </LegalPage>;
}