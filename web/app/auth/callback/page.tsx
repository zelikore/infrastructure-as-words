import { Suspense } from "react";
import { AuthCallbackClient } from "../../../components/auth-callback-client";

const fallback = (
  <section className="callbackCard">
    <p className="callbackEyebrow">Sign-in Flow</p>
    <h1 className="callbackTitle">Finishing the login handoff</h1>
    <p className="callbackBody">Preparing the callback route.</p>
  </section>
);

export default function AuthCallbackPage() {
  return (
    <main className="callbackPage">
      <Suspense fallback={fallback}>
        <AuthCallbackClient />
      </Suspense>
    </main>
  );
}
