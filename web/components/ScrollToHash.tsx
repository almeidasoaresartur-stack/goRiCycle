"use client";

import { useEffect } from "react";

type ScrollToHashProps = {
  trigger: string;
};

export function ScrollToHash({ trigger }: ScrollToHashProps) {
  useEffect(() => {
    if (!window.location.hash) return;

    const id = window.location.hash.slice(1);
    const scroll = () => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };

    requestAnimationFrame(() => {
      setTimeout(scroll, 100);
    });
  }, [trigger]);

  return null;
}
