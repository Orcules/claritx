import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const ScrollToTop = () => {
  const { pathname, search } = useLocation();

  useEffect(() => {
    // Scroll to top of the window on route change
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant", // Use "instant" for immediate jump when changing pages
    });
  }, [pathname, search]); // Re-run if path or query params change

  return null;
};
