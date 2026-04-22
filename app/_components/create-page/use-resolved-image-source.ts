"use client";

import { useEffect, useState } from "react";

import { isStoredAssetRef, resolveStoredAssetUrl } from "./storage";

export function useResolvedImageSource(source: string | null | undefined) {
  const [resolvedSource, setResolvedSource] = useState(() =>
    source && !isStoredAssetRef(source) ? source : "",
  );

  useEffect(() => {
    let isActive = true;
    let objectUrlToRevoke: string | null = null;

    if (!source) {
      setResolvedSource("");
      return;
    }

    if (!isStoredAssetRef(source)) {
      setResolvedSource(source);
      return;
    }

    setResolvedSource("");

    void resolveStoredAssetUrl(source)
      .then((nextSource) => {
        if (!isActive) {
          if (nextSource.startsWith("blob:")) {
            URL.revokeObjectURL(nextSource);
          }
          return;
        }

        objectUrlToRevoke = nextSource.startsWith("blob:") ? nextSource : null;
        setResolvedSource(nextSource);
      })
      .catch(() => {
        if (isActive) {
          setResolvedSource("");
        }
      });

    return () => {
      isActive = false;
      if (objectUrlToRevoke) {
        URL.revokeObjectURL(objectUrlToRevoke);
      }
    };
  }, [source]);

  return {
    resolvedSource,
    isResolving: typeof source === "string" && source.length > 0 && isStoredAssetRef(source) && !resolvedSource,
  };
}
