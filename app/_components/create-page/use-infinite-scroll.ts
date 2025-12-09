import { useCallback, useEffect, useRef, useState } from "react";

export function useInfiniteScroll({
  initialLimit = 10,
  increment = 10,
}: {
  initialLimit?: number;
  increment?: number;
} = {}) {
  const [limit, setLimit] = useState(initialLimit);
  const observerRef = useRef<IntersectionObserver | null>(null);

  const loadMoreRef = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (node) {
        const observer = new IntersectionObserver(
          (entries) => {
            if (entries[0].isIntersecting) {
              setLimit((prev) => prev + increment);
            }
          },
          { root: null, rootMargin: "200px", threshold: 0 }
        );

        observer.observe(node);
        observerRef.current = observer;
      }
    },
    [increment]
  );

  return { limit, loadMoreRef };
}
