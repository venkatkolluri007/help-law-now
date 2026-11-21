# Legal Ally on iOS

Use Node.js 22+ and a Mac with Xcode and its command-line tools installed for the iOS steps.

```sh
npm install
npm run build:mobile
npx cap add ios
npx cap sync ios
npx cap open ios
```

Run `cap add ios` only once. After frontend changes, repeat `build:mobile` and `cap sync ios`. In Xcode choose your team/signing settings, select an iPhone simulator or connected device, and run. App ID: `com.shivakolluri.legalally`; app name: `Legal Ally`.

`dist-mobile/index.html` and its assets are a separate static SPA. The regular `npm run build` and web deployment remain unchanged. Do not use the web SSR output as Capacitor's web directory. The iOS project is deliberately not created here.

Native API calls default to `https://triage-ally-ai.lovable.app`. To use another HTTPS deployment, set `VITE_API_BASE_URL` in `.env.local` **before** building mobile. Do not put an OpenAI key or any server secret in a `VITE_` variable. Web calls stay relative. Native chat uses streaming fetch; Capacitor's native HTTP interception is not enabled.

Publish the web changes before testing iOS: chat CORS and `/api/public/practice` must be deployed. Internet is required for chat, attorney lookup, and submissions; chats remain in memory only. Review privacy/terms with your legal advisor and check App Store privacy disclosures before submission.

On the simulator/device, check streamed chat completion, summary downloads, external attorney links, photo selection/submission, airplane-mode recovery, keyboard behavior, and safe areas. Browser checks do not replace real WKWebView testing.