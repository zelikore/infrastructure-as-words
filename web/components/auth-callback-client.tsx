"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { completeLogin } from "../lib/auth";

export function AuthCallbackClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [message, setMessage] = useState("Exchanging your authorization code.");

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      try {
        const code = searchParams.get("code");
        const state = searchParams.get("state");

        if (!code || !state) {
          throw new Error("The authorization response is missing a code or state.");
        }

        await completeLogin({ code, state });
        if (!cancelled) {
          setMessage("Authentication complete. Returning to your workspace.");
          router.replace("/");
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(error instanceof Error ? error.message : "Authentication failed.");
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [router, searchParams]);

  return (
    <section className="callbackCard">
      <p className="callbackEyebrow">Sign-in Flow</p>
      <h1 className="callbackTitle">Finishing the login handoff</h1>
      <p className="callbackBody">{message}</p>
    </section>
  );
}

