"use client";

import { Suspense, lazy, useEffect, useState } from "react";
import "react18-json-view/src/style.css";

const JsonView = lazy(() => import("react18-json-view"));

export default function InspectJson({ object }: { object: unknown }) {
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    setInitialized(true);
  }, []);

  if (!initialized) {
    return <></>;
  }

  if (!object) {
    return <></>;
  }

  return (
    <div className="text-xs">
      <Suspense fallback={<></>}>
        <JsonView src={object} theme="a11y" />
      </Suspense>
    </div>
  );
}
